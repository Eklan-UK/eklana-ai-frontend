"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Clock3, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getDrillIcon, getDrillTypeInfo, getDrillStatus, getDrillTypeLabel, DRILL_ESTIMATED_DURATION_LABEL } from "@/utils/drill";

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

export interface PlanDrillRowProps {
  drill: {
    _id: string;
    title: string;
    type: string;
    date: string;
  };
  assignmentId?: string;
  dueDate?: string;
  completedAt?: string;
  status?: string;
  hasBookmarks?: boolean;
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
  onPrefetch,
  onNavigate,
  onBookmarkToggle,
}: PlanDrillRowProps) {
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const typeInfo = getDrillTypeInfo(drill.type);
  const drillStatus = getDrillStatus({
    drill,
    dueDate,
    completedAt,
    assignmentStatus: status,
  });
  const isCompleted = drillStatus === "completed";
  const href =
    isCompleted && assignmentId
      ? `/account/drills/${drill._id}/completed?assignmentId=${assignmentId}`
      : assignmentId
        ? `/account/drills/${drill._id}?assignmentId=${assignmentId}`
        : `/account/drills/${drill._id}`;

  const catClass =
    CATEGORY_TEXT[typeInfo.color] ?? CATEGORY_TEXT.gray!;
  const thumbGrad = THUMB_GRADIENT[typeInfo.color] ?? THUMB_GRADIENT.gray!;

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
        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${thumbGrad} flex items-center justify-center text-2xl shrink-0 shadow-inner`}
      >
        {getDrillIcon(drill.type)}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
          {drill.title}
        </h3>
        <p className={`text-xs mt-0.5 font-medium ${catClass}`}>
          • {getDrillTypeLabel(drill.type)}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Clock3 className="w-3.5 h-3.5 shrink-0" />
          {DRILL_ESTIMATED_DURATION_LABEL}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
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
