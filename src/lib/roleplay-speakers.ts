import { z } from "zod";

export type RoleplayAiSpeakerId = `ai_${number}`;
export type RoleplaySpeakerId = "student" | RoleplayAiSpeakerId;

const AI_SPEAKER_RE = /^ai_(\d+)$/i;

/** True when speaker is ai_0, ai_1, … (any non-negative index). */
export function isRoleplayAiSpeakerId(speaker: string): boolean {
  const match = speaker.match(AI_SPEAKER_RE);
  if (!match) return false;
  const idx = Number.parseInt(match[1], 10);
  return Number.isFinite(idx) && idx >= 0;
}

export function isRoleplaySpeakerId(speaker: string): boolean {
  return speaker === "student" || isRoleplayAiSpeakerId(speaker);
}

/** Parse import labels (ai, ai_0, …) into a speaker id. */
export function parseRoleplayAiSpeakerId(
  speaker: string,
): RoleplayAiSpeakerId | null {
  const normalized = speaker.toLowerCase();
  if (normalized === "ai") return "ai_0";
  const match = normalized.match(AI_SPEAKER_RE);
  if (!match) return null;
  const idx = Number.parseInt(match[1], 10);
  if (!Number.isFinite(idx) || idx < 0) return null;
  return `ai_${idx}` as RoleplayAiSpeakerId;
}

export function parseRoleplaySpeakerId(speaker: string): RoleplaySpeakerId {
  if (speaker.toLowerCase() === "student") return "student";
  return parseRoleplayAiSpeakerId(speaker) ?? "student";
}

export const roleplaySpeakerIdSchema = z
  .string()
  .refine(isRoleplaySpeakerId, {
    message: 'Speaker must be "student" or "ai_<index>" (e.g. ai_0)',
  });

/** Mongoose validator for dialogue turn speaker fields. */
export function validateRoleplaySpeakerId(value: string): boolean {
  return isRoleplaySpeakerId(value);
}
