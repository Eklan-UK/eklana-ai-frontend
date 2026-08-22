"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Clock3, Bookmark, BookmarkCheck, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  getDrillIcon,
  getDrillTypeInfo,
  getDrillStatus,
  getDrillTypeLabel,
  DRILL_ESTIMATED_DURATION_LABEL,
  formatDate,
} from "@/utils/drill";
import { resolveDrillListTitle } from "@/lib/drill-display-label";
import { buildLearnerDrillHref } from "@/lib/drill-open-url";

const CATEGORY_TEXT: Record<string, string> = {
  green: "text-violet-600",
  blue: "text-sky-600",
  primary: "text-indigo-600",
  orange: "text-amber-700",
  indigo: "text-amber-600",
  pink: "text-pink-600",
  teal: "text-teal-700",
  violet: "text-violet-600",
  amber: "text-amber-700",
  emerald: "text-emerald-700",
  gray: "text-muted-foreground",
};

const THUMB_GRADIENT: Record<string, string> = {
  green: "from-emerald-200 to-teal-300",
  blue: "from-sky-200 to-blue-300",
  primary: "from-violet-200 to-purple-300",
  orange: "from-orange-200 to-amber-300",
  indigo: "from-amber-200 to-yellow-200",
  pink: "from-pink-200 to-rose-300",
  teal: "from-cyan-200 to-teal-300",
  violet: "from-violet-200 to-purple-300",
  amber: "from-amber-200 to-yellow-200",
  emerald: "from-emerald-200 to-green-300",
  gray: "from-muted to-muted dark:from-slate-600 dark:to-slate-700",
};

/** Soft solid pastels for journey accordion drill thumbs (Figma). */
const THUMB_SOLID: Record<string, string> = {
  green: "bg-[#dcfce7]",
  blue: "bg-[#eff6ff]",
  primary: "bg-[#ede9fe]",
  orange: "bg-[#ffedd5]",
  indigo: "bg-[#fef9c3]",
  pink: "bg-[#ffe4e6]",
  teal: "bg-[#ccfbf1]",
  violet: "bg-[#ede9fe]",
  amber: "bg-[#fef9c3]",
  emerald: "bg-[#dcfce7]",
  gray: "bg-muted",
};

export interface PlanDrillRowProps {
  drill: {
    _id: string;
    title: string;
    type: string;
    date: string;
    topicTitle?: string | null;
    learning_journey_topic?: string | null;
    scenarioType?: string | null;
  };
  assignmentId?: string;
  dueDate?: string;
  completedAt?: string;
  status?: string;
  hasBookmarks?: boolean;
  showTopicLabel?: boolean;
  /** Journey accordion presentation: solid pastel thumb + duration/due/Completed meta. */
  presentation?: "default" | "journey";
  onPrefetch?: (drillId: string) => void;
  /** Fires before navigation (e.g. activity tracking). */
  onNavigate?: () => void;
  onBookmarkToggle?: (drillId: string, bookmarked: boolean) => void | Promise<void>;
}

export function PlanDrillRow({
  drill,
  assignmentId,
  dueDate,
  completedAt,
  status,
  hasBookmarks = false,
  showTopicLabel = false,
  presentation = "default",
  onPrefetch,
  onNavigate,
  onBookmarkToggle,
}: PlanDrillRowProps) {
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const isJourney = presentation === "journey";
  const typeInfo = getDrillTypeInfo(drill.type);
  const drillStatus = getDrillStatus({
    drill,
    dueDate,
    completedAt,
    assignmentStatus: status,
  });
  const isCompleted = drillStatus === "completed";
  const isInProgress =
    status === "in-progress" || status === "in_progress";
  const href = buildLearnerDrillHref(drill._id, assignmentId, {
    completed: isCompleted,
  });

  const catClass =
    CATEGORY_TEXT[typeInfo.color] ?? CATEGORY_TEXT.gray!;
  const thumbGrad = THUMB_GRADIENT[typeInfo.color] ?? THUMB_GRADIENT.gray!;
  const thumbSolid = THUMB_SOLID[typeInfo.color] ?? THUMB_SOLID.gray!;
  const topicTitle =
    showTopicLabel && typeof drill.topicTitle === "string"
      ? drill.topicTitle
      : null;
  const dueLabel =
    !isCompleted && dueDate
      ? formatDate(dueDate)
      : null;

  const handleBookmarkClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onBookmarkToggle || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      await onBookmarkToggle(drill._id, hasBookmarks);
    } finally {
      setBookmarkLoading(false);
    }
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow"
      onMouseEnter={() => onPrefetch?.(drill._id)}
      onClick={() => onNavigate?.()}
    >
      <div
        className={
          isJourney
            ? `size-12 rounded-[13px] ${thumbSolid} flex items-center justify-center text-xl shrink-0`
            : `w-14 h-14 rounded-xl bg-gradient-to-br ${thumbGrad} flex items-center justify-center text-2xl shrink-0 shadow-inner`
        }
      >
        {getDrillIcon(drill.type)}
      </div>
      <div className="flex-1 min-w-0">
        {topicTitle ? (
          <p className="text-sm font-bold text-foreground line-clamp-2 mb-0.5">
            {topicTitle}
          </p>
        ) : null}
        <h3
          className={`text-foreground leading-snug line-clamp-2 ${
            isJourney
              ? "font-bold text-[13.5px]"
              : "font-semibold text-sm"
          }`}
        >
          {isJourney
            ? resolveDrillListTitle(drill)
            : drill.title?.trim() || getDrillTypeLabel(drill.type)}
        </h3>
        <p className={`text-xs mt-0.5 font-medium ${catClass}`}>
          • {getDrillTypeLabel(drill.type)}
          {!isJourney && isInProgress && !isCompleted ? (
            <span className="ml-1.5 text-sky-600">· In progress</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground mt-1">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="w-3.5 h-3.5 shrink-0" />
            {DRILL_ESTIMATED_DURATION_LABEL}
          </span>
          {dueLabel ? (
            <span className="text-muted-foreground">· Due {dueLabel}</span>
          ) : null}
          {isJourney && isCompleted ? (
            <span className="font-semibold text-[#22c55e]">· Completed</span>
          ) : null}
          {isJourney && isInProgress && !isCompleted ? (
            <span className="text-sky-600">· In progress</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isJourney && isCompleted ? (
          <CheckCircle2
            className="w-5 h-5 text-[#22c55e] shrink-0"
            aria-label="Completed"
          />
        ) : null}
        {onBookmarkToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`p-2 h-auto rounded-full ${
              hasBookmarks
                ? "text-[#22c55e] hover:text-[#16a34a] hover:bg-green-50"
                : "text-muted-foreground hover:text-[#22c55e] hover:bg-green-50"
            }`}
            onClick={handleBookmarkClick}
            disabled={bookmarkLoading}
            title={hasBookmarks ? "Remove from bookmarks" : "Save to bookmarks"}
            aria-label={hasBookmarks ? "Remove from bookmarks" : "Save to bookmarks"}
          >
            {bookmarkLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : hasBookmarks ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </Button>
        ) : null}
        <ChevronRight className="w-5 h-5 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}
