"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { useLearnerDrills, usePrefetchDrill } from "@/hooks/useDrills";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { useDrillBookmarkToggle } from "@/hooks/useDrillBookmarkToggle";
import { PlanDrillRow } from "@/components/drills/PlanDrillRow";
import { PlanFreeTalkRow } from "@/components/drills/PlanFreeTalkRow";
import { isFreeTalkPlanItem } from "@/lib/learner-assigned-plan";
import {
  getPartById,
  parseLearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";
import {
  groupDrillsByJourney,
  type JourneyDrillItem,
} from "@/lib/learning-journey/group-journey-drills";
import { trackActivity } from "@/utils/activity-cache";

export default function LearningJourneyPartPage() {
  const router = useRouter();
  const params = useParams();
  const part = parseLearningJourneyPartId(params.part);
  const { data: me, isLoading: meLoading } = useUserCurrent();
  const { data: drills = [], isLoading: drillsLoading } = useLearnerDrills({
    limit: 100,
  });
  const prefetchDrill = usePrefetchDrill();
  const { handleBookmarkToggle } = useDrillBookmarkToggle();

  useEffect(() => {
    if (!meLoading && me?.user != null && me.user.isSubscribed !== true) {
      router.replace("/account/settings/subscriptions");
    }
  }, [meLoading, me, router]);

  useEffect(() => {
    if (params.part != null && part == null) {
      router.replace("/account/drills");
    }
  }, [params.part, part, router]);

  const partDef = part != null ? getPartById(part) : undefined;

  const topicGroups = useMemo(() => {
    if (part == null) return [];
    return groupDrillsByJourney(drills as JourneyDrillItem[], part);
  }, [drills, part]);

  if (part == null || !partDef) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3 md:max-w-2xl md:px-8">
          <Link
            href="/account/drills"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            My Learning Journey
          </Link>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Part {part}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{partDef.title}</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-8">
        {drillsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          topicGroups.map(({ topic, items }) => (
            <section key={topic.id}>
              <h2 className="text-base font-bold text-foreground mb-3">{topic.title}</h2>
              {items.length === 0 ? (
                <Card className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">No drills assigned for this topic yet.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => {
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
                  })}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
