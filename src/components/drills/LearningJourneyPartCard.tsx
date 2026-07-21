"use client";

import Link from "next/link";
import {
  getMissionNumberLabel,
  getPartById,
  type DerivedMissionState,
} from "@/domain/learning-journey/learning-journey.catalog";

export interface LearningJourneyPartCardProps {
  state: DerivedMissionState;
  /** Play unlock transition when enrollment just unlocked this mission */
  unlocking?: boolean;
}

export function LearningJourneyPartCard({
  state,
  unlocking = false,
}: LearningJourneyPartCardProps) {
  const { part, status, percent, isCurrent, completed, total, accent } = state;
  const partDef = getPartById(part);
  const title = partDef?.title ?? getMissionNumberLabel(part);
  const locked = status === "locked";
  const completedLike =
    status === "completed" || status === "journeyComplete";

  const progressLabel =
    total > 0
      ? `${completed} of ${total} drills completed`
      : locked
        ? "Not enrolled yet"
        : "No drills assigned yet";

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
                width: `${percent}%`,
                backgroundColor: accent,
              }}
            />
          </div>
          <p className="text-[10px] font-nunito text-foreground/80 pt-0.5">
            {progressLabel}
          </p>
          {isCurrent ? (
            <div className="flex justify-end pt-1">
              <span className="inline-flex items-center justify-center rounded-full bg-[#ff7a00] px-4 py-1.5 text-[11px] font-bold text-white shadow-sm">
                Continue
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-[10px] font-nunito text-[#9ca3af] pt-0.5">
          {total > 0 ? progressLabel : "Not enrolled yet"}
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

  return (
    <Link
      href={`/account/drills/journey/${part}`}
      className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2a602c]"
      aria-label={`${getMissionNumberLabel(part)}: ${title}${
        isCurrent ? " — Continue" : ""
      }`}
    >
      {inner}
    </Link>
  );
}
