"use client";

import { useEffect, useState } from "react";
import { BookOpen, Bookmark, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useSavedDrills, usePrefetchDrill } from "@/hooks/useDrills";
import { useDrillBookmarkToggle } from "@/hooks/useDrillBookmarkToggle";
import { PlanDrillRow } from "@/components/drills/PlanDrillRow";
import { PlanFreeTalkRow } from "@/components/drills/PlanFreeTalkRow";
import { isFreeTalkPlanItem } from "@/lib/learning-journey/group-journey-drills";
import type { JourneyDrillItem } from "@/lib/learning-journey/group-journey-drills";
import { trackActivity } from "@/utils/activity-cache";

export interface SavedDrillsSectionProps {
  id?: string;
  title?: string;
  /** Expand on mount (e.g. My Plan with #saved-drills) */
  defaultExpanded?: boolean;
}

export function SavedDrillsSection({
  id = "saved-drills",
  title = "Saved Drills",
  defaultExpanded = false,
}: SavedDrillsSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { data: bookmarked = [], isLoading } = useSavedDrills();
  const prefetchDrill = usePrefetchDrill();
  const { handleBookmarkToggle } = useDrillBookmarkToggle();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#${id}`) {
      setExpanded(true);
    }
  }, [id]);

  const toggle = () => setExpanded((open) => !open);

  return (
    <section id={id}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={`${id}-panel`}
        className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm hover:shadow-md transition-shadow text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
          <Bookmark className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? "Loading…"
              : bookmarked.length === 0
                ? "No saved drills yet"
                : `${bookmarked.length} saved drill${bookmarked.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {!isLoading && bookmarked.length > 0 ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {bookmarked.length}
          </span>
        ) : null}
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
        )}
      </button>

      {expanded ? (
        <div id={`${id}-panel`} className="mt-3 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-7 h-7 animate-spin text-[#22c55e]" />
            </div>
          ) : bookmarked.length === 0 ? (
            <Card className="p-6 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Bookmark drills from your learning journey to find them here.
              </p>
            </Card>
          ) : (
            (bookmarked as JourneyDrillItem[]).map((item) => {
              const key = String(
                item.assignmentId ?? (item.drill as { _id?: string })?._id ?? "",
              );
              if (isFreeTalkPlanItem(item)) {
                const drill = item.drill as {
                  _id?: string;
                  title?: string;
                  scenarioType?: string;
                  completionDate?: string;
                };
                return (
                  <PlanFreeTalkRow
                    key={`free-talk-${key}`}
                    scenarioId={key}
                    title={drill?.title ?? "Free Talk"}
                    scenarioType={drill?.scenarioType ?? ""}
                    completionDate={drill?.completionDate ?? item.dueDate}
                    completedAt={item.completedAt}
                  />
                );
              }
              const drill = item.drill as {
                _id: string;
                title: string;
                type: string;
                date: string;
              };
              return (
                <PlanDrillRow
                  key={key}
                  drill={drill}
                  assignmentId={
                    item.assignmentId != null ? String(item.assignmentId) : undefined
                  }
                  dueDate={item.dueDate != null ? String(item.dueDate) : undefined}
                  completedAt={
                    item.completedAt != null ? String(item.completedAt) : undefined
                  }
                  status={item.status}
                  hasBookmarks={item.hasBookmarks === true}
                  onPrefetch={prefetchDrill}
                  onBookmarkToggle={handleBookmarkToggle}
                  onNavigate={() =>
                    trackActivity("drill", drill._id, "started", {
                      title: drill.title,
                      drillTitle: drill.title,
                      type: drill.type,
                      assignmentId: item.assignmentId,
                    })
                  }
                />
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
