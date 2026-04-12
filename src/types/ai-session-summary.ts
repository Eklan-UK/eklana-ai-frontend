/** Shared types for AI conversation session summaries (client + server safe). */

export type AiSessionMode = "free" | "topic" | "drill";

export interface TranscriptTurn {
  role: "user" | "model";
  content: string;
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
