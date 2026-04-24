/**
 * Post-session linguistic summary for AI conversation practice (Gemini JSON).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import type {
  SessionSummaryContext,
  SessionSummaryPayload,
  TranscriptTurn,
} from "@/types/ai-session-summary";

const DEFAULT_MODEL = config.GEMINI_SUMMARY_MODEL;
const FALLBACK_MODEL = config.GEMINI_SUMMARY_FALLBACK_MODEL;

const DEFAULT_SUMMARY: SessionSummaryPayload = {
  grammar: { headline: "Session recorded", detail: "We'll have a full breakdown ready next time." },
  vocabulary: { headline: "Session recorded" },
  flow: { headline: "Session recorded" },
  strengths: ["You showed up and practiced — that matters!"],
  tips: ["Keep practicing regularly for the best results."],
  encouragement: "Great job today! We've saved your session and will analyze it fully next time.",
  overallScore: undefined,
};

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
 * Call a Gemini model with exponential-backoff retry on transient errors (503/429).
 */
async function callModelWithRetry(
  modelName: string,
  prompt: string,
  maxRetries = 3,
): Promise<SessionSummaryPayload> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const model = genAI!.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1800 },
      });
      const result = await model.generateContent(prompt);
      return parseJsonObject(result.response.text());
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRetryable = /503|429|unavailable|overloaded|quota/i.test(msg);
      logger.warn(`Summary attempt ${attempt}/${maxRetries} failed (${modelName})`, {
        error: msg,
        retryable: isRetryable,
      });
      if (!isRetryable || attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error("Exhausted retries");
}

/**
 * Analyze transcript and return structured feedback for the learner.
 * Never throws on model failures — falls back through models then to a safe default.
 */
function buildSummaryPrompt(
  messages: TranscriptTurn[],
  context: SessionSummaryContext,
): string {
  const lines = messages
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n");

  const modeLine =
    context.mode === "drill"
      ? "Structured drill / guided practice"
      : context.mode === "topic"
        ? `Themed practice${context.topic ? ` (topic slug: ${context.topic})` : ""}`
        : "Open free conversation";

  const focusBlock = context.focusLabel
    ? `Practice focus (use this to frame goals and vocabulary): "${context.focusLabel}"\n`
    : "";

  return `You are an expert English teacher writing a personalized wrap-up for ONE completed practice session.

SESSION CONTEXT (must shape your feedback — do not ignore):
- Mode: ${context.mode} — ${modeLine}
${focusBlock}
FULL TRANSCRIPT (your evidence base — every claim must trace back here):
${lines}

Respond with ONLY valid JSON (no markdown, no code fences) in this exact shape:
{
  "grammar": { "headline": "short label", "detail": "one sentence" },
  "vocabulary": { "headline": "short label", "detail": "one sentence" },
  "flow": { "headline": "short label", "detail": "one sentence" },
  "strengths": ["2–4 items"],
  "tips": ["2–4 items"],
  "encouragement": "One warm sentence; start with praise (Great job / Nice work / Well done).",
  "overallScore": 75
}

STRICT PERSONALIZATION RULES:
1. grammar.detail MUST quote or closely paraphrase something the Student actually wrote (short clause). If their grammar was very clean, name the pattern they handled well with an example from the transcript.
2. vocabulary.detail MUST mention specific words or phrases the Student used, OR a clear gap (e.g. repeated simple word where a richer alternative appeared in the Tutor turn). No generic "expand vocabulary" without a transcript anchor.
3. flow.detail MUST describe how the Student responded to the Tutor in this chat (e.g. elaboration, answering the question, staying on ${context.mode === "topic" ? "the topic" : context.mode === "drill" ? "the drill task" : "the thread"}).
4. Every item in "strengths" must reference a concrete Student turn or pattern visible above (no platitudes like "you practiced English").
5. Every item in "tips" must fix something observable in THIS transcript only (not advice for "learners in general").
6. encouragement must name one specific positive from this session (topic, idea, or sentence they produced).
7. overallScore: 0–100 holistic for THIS session only; if the Student had very few short turns, score modestly and say so implicitly in tips.
8. If the transcript is mostly voice placeholders (e.g. "[Voice message]" with little text), infer only from available Tutor prompts and visible Student text — do not invent Student quotes.
9. All text in English.`;
}

export async function generateSessionSummaryFromTranscript(
  messages: TranscriptTurn[],
  context: SessionSummaryContext,
): Promise<SessionSummaryPayload> {
  if (!genAI) {
    throw new Error("Gemini API is not configured");
  }

  const prompt = buildSummaryPrompt(messages, context);

  // 1. Try primary model with retries
  try {
    const parsed = await callModelWithRetry(DEFAULT_MODEL, prompt);
    logger.info("Session summary generated", {
      model: DEFAULT_MODEL,
      overallScore: parsed.overallScore,
      strengthCount: parsed.strengths.length,
    });
    return parsed;
  } catch (primaryErr) {
    const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    logger.error("Primary summary model exhausted", { model: DEFAULT_MODEL, error: msg });
  }

  // 2. Try fallback model with retries
  try {
    const parsed = await callModelWithRetry(FALLBACK_MODEL, prompt);
    logger.info("Session summary generated (fallback)", {
      model: FALLBACK_MODEL,
      overallScore: parsed.overallScore,
      strengthCount: parsed.strengths.length,
    });
    return parsed;
  } catch (fallbackErr) {
    const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    logger.error("Fallback summary model exhausted", { model: FALLBACK_MODEL, error: msg });
  }

  // 3. All models unavailable — return safe default so the student always sees a summary
  logger.warn("Returning default summary — all models unavailable");
  return DEFAULT_SUMMARY;
}
