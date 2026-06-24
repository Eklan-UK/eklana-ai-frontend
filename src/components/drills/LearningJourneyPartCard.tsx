"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getMissionNumberLabel,
  getPartById,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";

export interface LearningJourneyPartCardProps {
  part: LearningJourneyPartId;
  completedCount: number;
  totalCount: number;
}

export function LearningJourneyPartCard({
  part,
  completedCount,
  totalCount,
}: LearningJourneyPartCardProps) {
  const partDef = getPartById(part);
  const title = partDef?.title ?? getMissionNumberLabel(part);

  return (
    <Link
      href={`/account/drills/journey/${part}`}
      className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center shrink-0">
        <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
          {part}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {getMissionNumberLabel(part)}
        </p>
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
          {title}
        </h3>
        {totalCount > 0 ? (
          <p className="text-xs text-muted-foreground mt-1">
            {completedCount} of {totalCount} drills completed
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">No drills assigned yet</p>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
    </Link>
  );
}
