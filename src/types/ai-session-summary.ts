/** Shared types for AI conversation session summaries (client + server safe). */

export type AiSessionMode = "free" | "topic" | "drill";

export interface TranscriptTurn {
  role: "user" | "model";
  content: string;
}

/** Optional context passed to the summarizer so feedback matches the session type. */
export interface SessionSummaryContext {
  mode: AiSessionMode;
  /** URL topic slug or theme (e.g. travel, pressure-test). */
  topic?: string;
  /** Human label: drill title, topic phrase, etc. */
  focusLabel?: string;
}

export interface SessionSummaryPayload {
  grammar: { headline: string; detail?: string };
  vocabulary: { headline: string; detail?: string };
  flow: { headline: string; detail?: string };
  strengths: string[];
  tips: string[];
  encouragement: string;
  overallScore?: number;
}
