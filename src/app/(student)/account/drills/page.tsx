"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { useLearnerDrills } from "@/hooks/useDrills";
import { useLearnerClasses } from "@/hooks/useClasses";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { adminDtoToTeachingClass } from "@/lib/classes/admin-dto-to-teaching";
import { pickNextLearnerSession } from "@/lib/classes/pick-next-learner-session";
import { LearnerNextSessionCard } from "@/components/classes/LearnerNextSessionCard";
import { StreakBadge } from "@/components/streak/StreakBadge";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SavedDrillsSection } from "@/components/drills/SavedDrillsSection";
import { LearningJourneyPartCard } from "@/components/drills/LearningJourneyPartCard";
import {
  LEARNING_JOURNEY_PARTS,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";
import {
  countPartJourneyProgress,
  type JourneyDrillItem,
} from "@/lib/learning-journey/group-journey-drills";

export default function DrillsPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useUserCurrent();

  useEffect(() => {
    if (!meLoading && me?.user != null && me.user.isSubscribed !== true) {
      router.replace("/account/settings/subscriptions");
    }
  }, [meLoading, me, router]);

  const { data: drills = [] } = useLearnerDrills({ limit: 100 });

  const { data: classData, isLoading: classesLoading } = useLearnerClasses({
    limit: 100,
  });

  const teachingClasses = useMemo(
    () => (classData?.classes ?? []).map(adminDtoToTeachingClass),
    [classData?.classes],
  );

  const nextSession = useMemo(
    () => pickNextLearnerSession(teachingClasses),
    [teachingClasses],
  );

  const journeyDrills = drills as JourneyDrillItem[];

  const partProgress = useMemo(() => {
    const map = new Map<LearningJourneyPartId, { completed: number; total: number }>();
    for (const partDef of LEARNING_JOURNEY_PARTS) {
      map.set(
        partDef.part,
        countPartJourneyProgress(journeyDrills, partDef.part),
      );
    }
    return map;
  }, [journeyDrills]);

  return (
    <div className="min-h-screen bg-background pb-[max(5.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3 md:max-w-2xl md:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground">My Plans</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Designed for you, based on your goals
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/account/streak"
                className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center shadow-sm"
                aria-label="Achievements"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M10 2L12.09 7.26L18 8.27L14 12.14L14.91 18.02L10 15.77L5.09 18.02L6 12.14L2 8.27L7.91 7.26L10 2Z"
                    fill="white"
                  />
                </svg>
              </Link>
              <StreakBadge />
              <NotificationBell />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-8">
        <LearnerNextSessionCard session={nextSession} isLoading={classesLoading} />

        <SavedDrillsSection />

        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">My Learning Journey</h2>
          <div className="space-y-3">
            {LEARNING_JOURNEY_PARTS.map((partDef) => {
              const progress = partProgress.get(partDef.part) ?? {
                completed: 0,
                total: 0,
              };
              return (
                <LearningJourneyPartCard
                  key={partDef.part}
                  part={partDef.part}
                  completedCount={progress.completed}
                  totalCount={progress.total}
                />
              );
            })}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
