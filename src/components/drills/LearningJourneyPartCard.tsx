"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getMissionNumberLabel,
  getPartById,
  type DerivedMissionState,
} from "@/domain/learning-journey/learning-journey.catalog";

export interface LearningJourneyPartCardProps {
  state: DerivedMissionState;
  /** Play unlock transition when enrollment just unlocked this mission */
  unlocking?: boolean;
  /** Override bar width during load animation (defaults to state.percent) */
  barPercent?: number;
}

export function LearningJourneyPartCard({
  state,
  unlocking = false,
  barPercent,
}: LearningJourneyPartCardProps) {
  const { part, status, percent, isCurrent, ctaLabel, completed, total, accent } =
    state;
  const partDef = getPartById(part);
  const title = partDef?.title ?? getMissionNumberLabel(part);
  const locked = status === "locked";
  const completedLike =
    status === "completed" || status === "journeyComplete";
  // Prefer animation override; otherwise use real progress (100% only when complete).
  const fillPercent =
    barPercent ?? (completedLike ? 100 : percent);
  const barColor = completedLike ? "#2a602c" : accent;

  const progressLabel =
    total > 0
      ? `${completed} of ${total} drills completed`
      : locked
        ? "Not enrolled yet"
        : "No drills assigned yet";

  const ctaText =
    ctaLabel === "start" ? "Start" : ctaLabel === "continue" ? "Continue" : null;

  const cardClass = locked
    ? "border border-dashed border-[#e0e0e0] dark:border-border bg-card opacity-60"
    : "border-2 bg-card shadow-[0px_4px_10px_rgba(0,0,0,0.05)]";

  const cardStyle = !locked
    ? {
        borderColor: `${accent}33`,
      }
    : undefined;

  const labelColorClass = locked
    ? "text-[#9ca3af]"
    : completedLike
      ? "text-[#2a602c] dark:text-emerald-400"
      : "";

  const titleColor = locked
    ? "text-[#6b7280] dark:text-muted-foreground"
    : "text-foreground";

  const inner = (
    <div
      className={`journey-card-unlock flex flex-col gap-2 rounded-2xl p-[18px] ${cardClass} ${
        unlocking ? "journey-card-just-unlocked" : ""
      }`}
      style={cardStyle}
    >
      {!locked ? (
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.5px] font-nunito ${labelColorClass}`}
            style={!labelColorClass ? { color: accent } : undefined}
          >
            Mission {part}
          </p>
          <p
            className={`text-[11px] font-bold font-nunito shrink-0 ${labelColorClass}`}
            style={!labelColorClass ? { color: accent } : undefined}
          >
            {percent}%
          </p>
        </div>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-[0.5px] font-nunito text-[#9ca3af] pt-1.5">
          Mission {part}
        </p>
      )}

      <h3
        className={`text-sm font-bold font-nunito leading-snug ${titleColor}`}
      >
        {title}
      </h3>

      {!locked ? (
        <>
          <div className="h-2 w-full rounded-full bg-[#f3f4f6] dark:bg-muted overflow-hidden">
            <div
              className="journey-progress-fill h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, fillPercent))}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <p className="text-[10px] font-nunito text-foreground/80 min-w-0">
              {progressLabel}
            </p>
            {ctaText ? (
              <span
                className="inline-flex items-center gap-0.5 shrink-0 text-[11px] font-bold font-nunito"
                style={{ color: accent }}
              >
                {ctaText}
                <ChevronRight className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-[10px] font-nunito text-[#9ca3af] pt-0.5">
          {total > 0 ? `${completed} of ${total} drills completed` : "Not enrolled yet"}
        </p>
      )}
    </div>
  );

  if (locked) {
    return (
      <div className="w-full cursor-not-allowed" aria-disabled>
        {inner}
      </div>
    );
  }

  const ctaAria = ctaText ? ` — ${ctaText}` : isCurrent ? " — Current" : "";

  return (
    <Link
      href={`/account/drills/journey/${part}`}
      className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2a602c]"
      aria-label={`${getMissionNumberLabel(part)}: ${title}${ctaAria}`}
    >
      {inner}
    </Link>
  );
}
