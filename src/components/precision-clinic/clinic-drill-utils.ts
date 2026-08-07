/**
 * Helpers for the Eklan Precision Clinic admin list.
 *
 * Published / Draft rule:
 * - Published = assignedLearnerIds.length > 0
 * - Draft = none
 *
 * Exactly 7 Clinic types (Figma create frames).
 */

import {
  PRECISION_CLINIC_DRILL_TYPES,
  PRECISION_CLINIC_DRILL_TYPE_LABELS,
  type PrecisionClinicDrillType,
} from "@/domain/precision-clinic/types";

export type ClinicDrillType = PrecisionClinicDrillType;

export const CLINIC_TYPE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Types" },
  ...PRECISION_CLINIC_DRILL_TYPES.map((type) => ({
    value: type,
    label: PRECISION_CLINIC_DRILL_TYPE_LABELS[type],
  })),
];

export const CLINIC_STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

export const CLINIC_DIFFICULTY_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Difficulty" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/** Figma pastel pairs for the 7 Clinic types. */
export const CLINIC_TYPE_PILL_STYLES: Record<string, { bg: string; text: string }> = {
  grammar: { bg: "#fff7ed", text: "#ea580c" },
  pronunciation: { bg: "#dcfce7", text: "#16a34a" },
  key_phrases: { bg: "#fef9c3", text: "#ca8a04" },
  matching: { bg: "#ede9fe", text: "#7c3aed" },
  sentence_writing: { bg: "#e0f2fe", text: "#0284c7" },
  listening: { bg: "#ecfeff", text: "#0891b2" },
  summary: { bg: "#fce7f3", text: "#db2777" },
};

export const CLINIC_DIFFICULTY_PILL_STYLES: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "#dcfce7", text: "#16a34a" },
  intermediate: { bg: "#fef9c3", text: "#ca8a04" },
  advanced: { bg: "#fee2e2", text: "#dc2626" },
};

export function formatClinicTypeLabel(type: string): string {
  if (type in PRECISION_CLINIC_DRILL_TYPE_LABELS) {
    return PRECISION_CLINIC_DRILL_TYPE_LABELS[type as PrecisionClinicDrillType];
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function clinicHasAssignments(drill: {
  assignedLearnerIds?: unknown[];
}): boolean {
  return (
    Array.isArray(drill.assignedLearnerIds) && drill.assignedLearnerIds.length > 0
  );
}

/** Published = has ≥1 assignee; Draft = none. */
export function getClinicPublishStatus(drill: {
  assignedLearnerIds?: unknown[];
}): "published" | "draft" {
  return clinicHasAssignments(drill) ? "published" : "draft";
}

/** @deprecated Prefer clinicHasAssignments — kept for call-site clarity during rewire. */
export const drillHasAssignments = clinicHasAssignments;

/**
 * Count practice items for the Clinic document shape (mirrors domain countClinicPracticeItems).
 */
export function countClinicPracticeItems(drill: {
  type?: string;
  soundGroups?: unknown[];
  questions?: unknown[];
  pairs?: unknown[];
  patterns?: unknown[];
  words?: unknown[];
  contentTitle?: string;
  content?: string;
  articleTitle?: string;
  articleContent?: string;
}): number {
  const type = String(drill.type ?? "");
  const len = (arr: unknown[] | undefined) =>
    Array.isArray(arr) ? arr.length : 0;

  switch (type) {
    case "pronunciation": {
      const groups = drill.soundGroups ?? [];
      if (!Array.isArray(groups)) return 0;
      return groups.reduce<number>((sum, g) => {
        const words =
          g && typeof g === "object" && "words" in g
            ? (g as { words?: unknown[] }).words
            : undefined;
        return sum + (Array.isArray(words) ? words.length : 0);
      }, 0);
    }
    case "key_phrases":
      return len(drill.questions);
    case "matching":
      return len(drill.pairs);
    case "grammar":
      return len(drill.patterns);
    case "sentence_writing":
      return len(drill.words);
    case "listening":
      return drill.content || drill.contentTitle ? 1 : 0;
    case "summary":
      return drill.articleContent || drill.articleTitle ? 1 : 0;
    default:
      return 0;
  }
}

/** @deprecated Prefer countClinicPracticeItems. */
export const countDrillPracticeItems = countClinicPracticeItems;

export function formatRelativeTime(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return "—";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let duration = seconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return date.toLocaleDateString();
}

export function creatorDisplayName(drill: {
  createdByEmail?: string;
  created_by?: string;
  createdBy?:
    | string
    | { firstName?: string; lastName?: string; email?: string };
}): string {
  const populated = drill.createdBy;
  if (populated && typeof populated === "object") {
    const name = `${populated.firstName ?? ""} ${populated.lastName ?? ""}`.trim();
    if (name) return name;
    if (populated.email) return populated.email;
  }
  const email = (drill.createdByEmail ?? drill.created_by)?.trim();
  if (!email) return "Unknown";
  const local = email.split("@")[0];
  return local || email;
}

export function getClinicUpdatedAt(drill: {
  updatedAt?: string | Date;
  createdAt?: string | Date;
}): string | Date | undefined {
  return drill.updatedAt ?? drill.createdAt;
}

/** @deprecated Prefer getClinicUpdatedAt. */
export const getDrillUpdatedAt = getClinicUpdatedAt;

/**
 * Client-side duplicate payload for the new Clinic document shape.
 * Prefer the `/duplicate` API when available; this is a fallback mapper.
 */
export function buildDuplicateClinicPayload(
  drill: Record<string, unknown>
): Record<string, unknown> {
  const omit = new Set([
    "_id",
    "__v",
    "id",
    "assignedLearnerIds",
    "isArchived",
    "createdAt",
    "updatedAt",
    "createdBy",
    "createdByEmail",
  ]);

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(drill)) {
    if (omit.has(key)) continue;
    payload[key] = value;
  }

  payload.assignedLearnerIds = [];
  payload.isArchived = false;
  const title = typeof drill.title === "string" ? drill.title : "Untitled Drill";
  payload.title = title.endsWith("(Copy)") ? title : `${title} (Copy)`;

  return payload;
}
