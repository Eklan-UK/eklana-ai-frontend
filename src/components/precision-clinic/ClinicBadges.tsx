"use client";

import {
  CLINIC_DIFFICULTY_PILL_STYLES,
  CLINIC_TYPE_PILL_STYLES,
  formatClinicTypeLabel,
  getClinicPublishStatus,
} from "./clinic-drill-utils";

export function ClinicTypeBadge({ type }: { type: string }) {
  const style = CLINIC_TYPE_PILL_STYLES[type] ?? {
    bg: "#f3f4f6",
    text: "#4b5563",
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap dark:opacity-90"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {formatClinicTypeLabel(type)}
    </span>
  );
}

export function ClinicDifficultyBadge({ difficulty }: { difficulty: string }) {
  const style = CLINIC_DIFFICULTY_PILL_STYLES[difficulty] ?? {
    bg: "#f3f4f6",
    text: "#4b5563",
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize whitespace-nowrap dark:opacity-90"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {difficulty || "—"}
    </span>
  );
}

export function ClinicStatusBadge({
  drill,
}: {
  drill: { assignedLearnerIds?: unknown[] };
}) {
  const status = getClinicPublishStatus(drill);
  const isPublished = status === "published";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-foreground">
      <span
        className={`h-2 w-2 rounded-full ${
          isPublished ? "bg-emerald-500" : "bg-amber-400"
        }`}
        aria-hidden
      />
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}
