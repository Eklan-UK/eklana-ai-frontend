/**
 * Post-session linguistic summary for AI conversation practice (Gemini JSON).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import type { SessionSummaryPayload, TranscriptTurn } from "@/types/ai-session-summary";

const DEFAULT_MODEL = "gemini-2.5-flash";

let genAI: GoogleGenerativeAI | null = null;
if (config.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
}

function parseJsonObject(text: string): SessionSummaryPayload {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object in model response");
  }
  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  const str = (v: unknown, fallback = ""): string =>
    typeof v === "string" ? v : fallback;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && v >= 0 && v <= 100 ? v : undefined;

  const sub = (o: unknown, key: "grammar" | "vocabulary" | "flow") => {
    if (o && typeof o === "object" && key in (o as object)) {
      const block = (o as Record<string, unknown>)[key];
      if (block && typeof block === "object") {
        const b = block as Record<string, unknown>;
        return {
          headline: str(b.headline, "—"),
          detail: b.detail != null ? str(b.detail) : undefined,
        };
      }
    }
    return { headline: "—", detail: undefined };
  };

  const grammar = sub(raw, "grammar");
  const vocabulary = sub(raw, "vocabulary");
  const flow = sub(raw, "flow");

  return {
    grammar,
    vocabulary,
    flow,
    strengths: strArr(raw.strengths).slice(0, 8),
    tips: strArr(raw.tips).slice(0, 8),
    encouragement: str(raw.encouragement, "Great job practicing today!"),
    overallScore: num(raw.overallScore),
  };
}

/**
 * Analyze transcript and return structured feedback for the learner.
 */
export async function generateSessionSummaryFromTranscript(
  messages: TranscriptTurn[],
): Promise<SessionSummaryPayload> {
  if (!genAI) {
    throw new Error("Gemini API is not configured");
  }

  const lines = messages
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n");

  const prompt = `You are an expert English teacher. Read this English practice conversation and give concise, encouraging feedback.

Conversation:
${lines}

Respond with ONLY valid JSON (no markdown fences) in this exact shape:
{
  "grammar": { "headline": "short label", "detail": "one sentence" },
  "vocabulary": { "headline": "short label", "detail": "one sentence" },
  "flow": { "headline": "short label", "detail": "one sentence" },
  "strengths": ["bullet 1", "bullet 2", "up to 4 items"],
  "tips": ["actionable tip 1", "tip 2", "up to 4 items"],
  "encouragement": "One warm sentence starting with praise (Great job / Nice work / Well done).",
  "overallScore": 75
}

Rules:
- overallScore is 0-100 for overall spoken English quality in this chat (holistic).
- Be specific to what the student actually said; avoid generic filler.
- If the student barely spoke, lower the score and keep tips short and kind.
- All text in English.`;

  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1200,
    },
  });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonObject(text);
    logger.info("Session summary generated", {
      overallScore: parsed.overallScore,
      strengthCount: parsed.strengths.length,
    });
    return parsed;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Session summary generation failed", { error: msg });
    throw new Error(`Failed to generate session summary: ${msg}`);
  }
}
