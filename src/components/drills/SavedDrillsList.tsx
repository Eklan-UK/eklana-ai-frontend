"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useSavedDrills, usePrefetchDrill } from "@/hooks/useDrills";
import { useDrillBookmarkToggle } from "@/hooks/useDrillBookmarkToggle";
import { PlanDrillRow } from "@/components/drills/PlanDrillRow";
import { PlanFreeTalkRow } from "@/components/drills/PlanFreeTalkRow";
import { isFreeTalkPlanItem } from "@/lib/learning-journey/group-journey-drills";
import type { JourneyDrillItem } from "@/lib/learning-journey/group-journey-drills";
import { trackActivity } from "@/utils/activity-cache";

export interface SavedDrillsListProps {
  showTopicLabel?: boolean;
}

export function SavedDrillsList({
  showTopicLabel = false,
}: SavedDrillsListProps) {
  const { data: bookmarked = [], isLoading } = useSavedDrills();
  const prefetchDrill = usePrefetchDrill();
  const { handleBookmarkToggle } = useDrillBookmarkToggle();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-7 h-7 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  if (bookmarked.length === 0) {
    return (
      <Card className="p-6 text-center">
        <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Bookmark drills from your learning journey to find them here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {(bookmarked as JourneyDrillItem[]).map((item) => {
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
              showTopicLabel={showTopicLabel}
              topicTitle={
                typeof (drill as { topicTitle?: string })?.topicTitle ===
                "string"
                  ? (drill as { topicTitle: string }).topicTitle
                  : null
              }
            />
          );
        }
        const drill = item.drill as {
          _id: string;
          title: string;
          type: string;
          date: string;
          topicTitle?: string | null;
          learning_journey_topic?: string;
          scenarioType?: string;
        };
        return (
          <PlanDrillRow
            key={key}
            drill={drill}
            assignmentId={
              item.assignmentId != null
                ? String(item.assignmentId)
                : undefined
            }
            dueDate={
              item.dueDate != null ? String(item.dueDate) : undefined
            }
            completedAt={
              item.completedAt != null
                ? String(item.completedAt)
                : undefined
            }
            status={item.status}
            hasBookmarks={item.hasBookmarks === true}
            showTopicLabel={showTopicLabel}
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
      })}
    </div>
  );
}
