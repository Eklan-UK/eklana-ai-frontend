"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import {
  getMissionNumberLabel,
  getPartById,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";

export interface LearningJourneyPartCardProps {
  part: LearningJourneyPartId;
  completedCount: number;
  totalCount: number;
  isEnrolled?: boolean;
  isLocked?: boolean;
}

export function LearningJourneyPartCard({
  part,
  completedCount,
  totalCount,
  isEnrolled = true,
  isLocked = false,
}: LearningJourneyPartCardProps) {
  const partDef = getPartById(part);
  const title = partDef?.title ?? getMissionNumberLabel(part);
  const locked = isLocked || !isEnrolled;

  const inner = (
    <>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          locked
            ? "bg-muted border border-border"
            : "bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/40 dark:to-teal-900/40"
        }`}
      >
        {locked ? (
          <Lock className="w-5 h-5 text-muted-foreground" aria-hidden />
        ) : (
          <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
            {part}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {getMissionNumberLabel(part)}
        </p>
        <h3
          className={`font-semibold text-sm leading-snug line-clamp-2 ${
            locked ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {title}
        </h3>
        {locked ? (
          <p className="text-xs text-muted-foreground mt-1">Not enrolled yet</p>
        ) : totalCount > 0 ? (
          <p className="text-xs text-muted-foreground mt-1">
            {completedCount} of {totalCount} drills completed
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">No drills assigned yet</p>
        )}
      </div>
      {!locked && (
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
      )}
    </>
  );

  if (locked) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 opacity-75 cursor-not-allowed"
        aria-disabled
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/account/drills/journey/${part}`}
      className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      {inner}
    </Link>
  );
}
