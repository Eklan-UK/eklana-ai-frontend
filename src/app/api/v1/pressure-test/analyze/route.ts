import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withPremium } from "@/lib/api/middleware";
import { logger } from "@/lib/api/logger";
import config from "@/lib/api/config";
import { speechaceService } from "@/lib/api/speechace.service";
import { connectToDatabase } from "@/lib/api/db";
import PressureTestSession from "@/models/pressure-test-session";
import PressureTestRawData from "@/models/pressure-test-raw-data";
import User from "@/models/user";
import Drill from "@/models/drill";
import { buildSessionPromptSnapshot } from "@/lib/api/pressure-test-prompts";

const MAX_AUDIO_SIZE = 5 * 1024 * 1024;
const LEVEL_UP_THRESHOLD = 75;
const LEVEL_DOWN_THRESHOLD = 25;

function wordQuality(score: number): "correct" | "mispronounced" | "missing" {
  if (score >= 70) return "correct";
  if (score >= 1) return "mispronounced";
  return "missing";
}

const PRESSURE_MENTAL_MS = 2000;

const analyzeSchema = z.object({
  level: z.number().int().min(1).max(20).default(1),
  drillId: z.string().optional(),
  turns: z
    .array(
      z.object({
        turnNumber: z.number().int().min(1).max(3),
        aiPrompt: z.string().min(1),
        studentResponseText: z.string().min(1),
        latencyMs: z.number().min(0),
        /** Strict &lt; PRESSURE_MENTAL_MS = fast. Backfilled from latency if omitted. */
        speedSuccess: z.boolean().optional(),
        scenarioId: z.string().min(1).optional(),
        audioDurationMs: z.number().min(0).default(0),
        audioBase64: z.string().min(10),
      }),
    )
    .min(1),
});

function resolveSpeedSuccess(turn: { latencyMs: number; speedSuccess?: boolean }): boolean {
  if (typeof turn.speedSuccess === "boolean") return turn.speedSuccess;
  return turn.latencyMs < PRESSURE_MENTAL_MS;
}

function labelFromScore(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Growing";
  return "Building";
}

function speedLabel(seconds: number): string {
  if (seconds <= 1.5) return "Excellent speed";
  if (seconds <= 2.5) return "Strong speed";
  if (seconds <= 4) return "Improving speed";
  return "Needs faster response";
}

interface SessionEvaluation {
  accuracy: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  turnFeedback: Array<{
    turnNumber: number;
    feedback: string;
    rating: "strong" | "adequate" | "needs_work";
  }>;
}

async function evaluateSession(
  turns: Array<{ turnNumber: number; aiPrompt: string; studentResponseText: string; latencyMs: number }>,
  level: number,
): Promise<SessionEvaluation> {
  if (!config.GEMINI_API_KEY) {
    return {
      accuracy: 50,
      confidence: 50,
      strengths: ["Completed the pressure test"],
      weaknesses: ["Analysis unavailable"],
      nextSteps: ["Continue practicing"],
      turnFeedback: turns.map((t) => ({
        turnNumber: t.turnNumber,
        feedback: "Keep practising.",
        rating: "adequate" as const,
      })),
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: config.GEMINI_CHAT_MODEL,
      generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
    });

    const turnsText = turns
      .map(
        (t) =>
          `Turn ${t.turnNumber}:\n  AI: "${t.aiPrompt}"\n  Student: "${t.studentResponseText}"\n  Response time: ${t.latencyMs}ms`,
      )
      .join("\n\n");

    const prompt = `You are an expert English language assessor for the Eklan Pressure Test.
Student level: ${level}/20.

Evaluate these pressure-test turns and return a JSON object. Be specific — reference actual words and phrases from the student's responses.

Turns:
${turnsText}

Return ONLY a valid JSON object with this exact shape (no markdown, no extra text):
{
  "accuracy": <integer 0-100, grammatical correctness + relevance to prompt>,
  "confidence": <integer 0-100, natural fluency + decisiveness + low hesitation — lower latency means higher confidence>,
  "strengths": [<2-3 specific things the student did well, referencing their actual words>],
  "weaknesses": [<2-3 specific areas for improvement>],
  "nextSteps": [<2-3 actionable, concrete practice recommendations>],
  "turnFeedback": [
    { "turnNumber": 1, "feedback": "<one concise sentence about this turn>", "rating": "strong" | "adequate" | "needs_work" }
  ]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json|^```|```$/gm, "").trim();
    const parsed = JSON.parse(raw);

    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    const asArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    const validRating = (r: unknown): "strong" | "adequate" | "needs_work" =>
      r === "strong" || r === "needs_work" ? r : "adequate";

    return {
      accuracy: clamp(parsed.accuracy) || 50,
      confidence: clamp(parsed.confidence) || 50,
      strengths: asArr(parsed.strengths).slice(0, 3),
      weaknesses: asArr(parsed.weaknesses).slice(0, 3),
      nextSteps: asArr(parsed.nextSteps).slice(0, 3),
      turnFeedback: Array.isArray(parsed.turnFeedback)
        ? parsed.turnFeedback.map((tf: any) => ({
            turnNumber: Number(tf.turnNumber) || 1,
            feedback: String(tf.feedback || "").trim(),
            rating: validRating(tf.rating),
          }))
        : [],
    };
  } catch (error) {
    logger.warn("Pressure-test LLM evaluation fallback used", { error });
    return {
      accuracy: 50,
      confidence: 50,
      strengths: ["Completed the pressure test"],
      weaknesses: ["Could not fully evaluate this session"],
      nextSteps: ["Continue practising regularly"],
      turnFeedback: turns.map((t) => ({
        turnNumber: t.turnNumber,
        feedback: "Keep practising.",
        rating: "adequate" as const,
      })),
    };
  }
}

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  void context.userRole;
  try {
    const body = await req.json();
    const validated = analyzeSchema.parse(body);

    for (const turn of validated.turns) {
      const audioBuffer = Buffer.from(turn.audioBase64, "base64");
      if (audioBuffer.length > MAX_AUDIO_SIZE) {
        return NextResponse.json(
          { code: "ValidationError", message: "Audio payload exceeds 5MB limit." },
          { status: 400 },
        );
      }
    }

    await connectToDatabase();

    // Read the student's current pressure test level from the database
    const userDoc = await User.findById(context.userId).select("pressureTestLevel").lean();
    const levelBefore: number = (userDoc as any)?.pressureTestLevel ?? validated.level;

    // Score pronunciation (per turn) + qualitative evaluation (Gemini) in parallel.
    // Speechace calls are independent across turns so we fan them out with Promise.allSettled.
    const userId = context.userId.toString();
    const [speechaceResults, evaluation] = await Promise.all([
      Promise.allSettled(
        validated.turns.map((turn) =>
          speechaceService.scorePronunciation(
            turn.studentResponseText,
            turn.audioBase64,
            userId,
            turn.aiPrompt,
          ),
        ),
      ),
      evaluateSession(
        validated.turns.map((t) => ({
          turnNumber: t.turnNumber,
          aiPrompt: t.aiPrompt,
          studentResponseText: t.studentResponseText,
          latencyMs: t.latencyMs,
        })),
        levelBefore,
      ),
    ]);

    const pronunciationScores: number[] = [];
    const pronunciationWordScoresPerTurn: Array<Array<{ word: string; score: number; phonemes?: Array<{ phoneme: string; score: number }> }>> = [];

    for (let i = 0; i < speechaceResults.length; i++) {
      const res = speechaceResults[i];
      if (res.status === "fulfilled") {
        pronunciationScores.push(Math.round(Number(res.value.text_score || 0)));
        pronunciationWordScoresPerTurn.push(res.value.word_scores ?? []);
      } else {
        logger.warn("Speechace score failed for turn", {
          turnNumber: validated.turns[i].turnNumber,
          error: res.reason,
        });
        pronunciationScores.push(0);
        pronunciationWordScoresPerTurn.push([]);
      }
    }

    const { accuracy, confidence, strengths, weaknesses, nextSteps, turnFeedback } = evaluation;

    const avgLatencyMs =
      validated.turns.reduce((acc, turn) => acc + turn.latencyMs, 0) / validated.turns.length;
    const responseSpeedSeconds = Number((avgLatencyMs / 1000).toFixed(1));
    const pronunciation =
      pronunciationScores.length > 0
        ? Math.round(pronunciationScores.reduce((a, b) => a + b, 0) / pronunciationScores.length)
        : 0;

    const progressToNextLevel = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          accuracy * 0.4 +
            pronunciation * 0.3 +
            confidence * 0.2 +
            Math.max(0, 100 - responseSpeedSeconds * 22) * 0.1,
        ),
      ),
    );

    // Level progression engine
    let levelAfter = levelBefore;
    if (progressToNextLevel >= LEVEL_UP_THRESHOLD) {
      levelAfter = Math.min(levelBefore + 1, 20);
    } else if (progressToNextLevel <= LEVEL_DOWN_THRESHOLD) {
      levelAfter = Math.max(levelBefore - 1, 1);
    }

    // Persist updated level on user if it changed
    if (levelAfter !== levelBefore) {
      await User.findByIdAndUpdate(context.userId, { pressureTestLevel: levelAfter });
    }

    // Persist session
    const session = await PressureTestSession.create({
      userId: context.userId,
      drillId: validated.drillId ?? null,
      level: levelBefore,
      levelBefore,
      levelAfter,
      progressToNextLevel,
      overallResponseSpeed: responseSpeedSeconds,
      overallAccuracy: accuracy,
      overallPronunciation: pronunciation,
      overallConfidence: confidence,
      strengths,
      weaknesses,
      nextSteps,
      turnFeedback,
      turns: validated.turns.map((turn) => ({
        turnNumber: turn.turnNumber,
        aiPrompt: turn.aiPrompt,
        studentResponseText: turn.studentResponseText,
        latencyMs: turn.latencyMs,
        speedSuccess: resolveSpeedSuccess(turn),
        ...(turn.scenarioId != null && turn.scenarioId !== "" ? { scenarioId: turn.scenarioId } : {}),
      })),
    });

    // Fetch drill for the system prompt snapshot (best-effort, non-blocking for main path)
    let drillForSnapshot: any = null;
    try {
      if (validated.drillId) {
        drillForSnapshot = await Drill.findById(validated.drillId).lean();
      }
    } catch {
      // snapshot will be written without drill enrichment
    }
    const systemPromptSnapshot = buildSessionPromptSnapshot(levelBefore, drillForSnapshot);

    // Persist raw data for data sovereignty and future fine-tuning
    // Audio is stored base64-encoded; per-turn guard keeps each turn under 5 MB so the
    // entire document stays comfortably within MongoDB's 16 MB BSON limit.
    try {
      await PressureTestRawData.create({
        sessionId: session._id,
        userId: context.userId,
        drillId: validated.drillId ?? null,
        level: levelBefore,
        geminiModelUsed: config.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash-lite",
        systemPromptSnapshot,
        turns: validated.turns.map((turn, i) => ({
          turnNumber: turn.turnNumber,
          aiPrompt: turn.aiPrompt,
          studentTranscript: turn.studentResponseText,
          latencyMs: turn.latencyMs,
          speedSuccess: resolveSpeedSuccess(turn),
          ...(turn.scenarioId != null && turn.scenarioId !== "" ? { scenarioId: turn.scenarioId } : {}),
          audioBase64: turn.audioBase64,
          audioMimeType: "audio/webm",
          audioDurationMs: turn.audioDurationMs ?? 0,
          pronunciationOverallScore: pronunciationScores[i] ?? 0,
          pronunciationWordScores: (pronunciationWordScoresPerTurn[i] ?? []).map((ws) => ({
            word: ws.word,
            score: ws.score,
            quality: wordQuality(ws.score),
            phonemes: ws.phonemes,
          })),
          accuracyScore: accuracy,
          confidenceScore: confidence,
        })),
      });
    } catch (rawError) {
      // Raw data write is best-effort — do not fail the whole request
      logger.warn("Failed to write PressureTestRawData", { error: rawError });
    }

    return NextResponse.json({
      code: "Success",
      message: "Pressure test analysed successfully",
      data: {
        responseSpeedSeconds,
        responseSpeedLabel: speedLabel(responseSpeedSeconds),
        sentenceAccuracy: { value: accuracy, label: labelFromScore(accuracy) },
        pronunciation: { value: pronunciation, label: labelFromScore(pronunciation) },
        confidence: { value: confidence, label: labelFromScore(confidence) },
        level: levelBefore,
        levelBefore,
        levelAfter,
        levelChanged: levelAfter !== levelBefore,
        progressToNextLevel,
        strengths,
        weaknesses,
        nextSteps,
        turnFeedback,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: "ValidationError", message: "Validation failed", errors: error.issues },
        { status: 400 },
      );
    }
    const err = error as { message?: string; stack?: string };
    logger.error("Error in pressure-test analyze handler", {
      error: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { code: "ServerError", message: err.message || "Failed to analyze pressure test." },
      { status: 500 },
    );
  }
}

export const POST = withPremium(handler);
export const maxDuration = 300;
