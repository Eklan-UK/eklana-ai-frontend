"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Loader2, BookOpen } from "lucide-react";
import { useLearnerDrills, usePrefetchDrill } from "@/hooks/useDrills";
import { useLearnerClasses } from "@/hooks/useClasses";
import { getDrillStatus } from "@/utils/drill";
import { trackActivity } from "@/utils/activity-cache";
import { adminDtoToTeachingClass } from "@/lib/classes/admin-dto-to-teaching";
import { pickNextLearnerSession } from "@/lib/classes/pick-next-learner-session";
import { PlanDrillRow } from "@/components/drills/PlanDrillRow";
import { LearnerNextSessionCard } from "@/components/classes/LearnerNextSessionCard";
import { StreakBadge } from "@/components/streak/StreakBadge";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type PlanTab = "ongoing" | "reviewed" | "completed";

function drillPlanTab(item: {
  completedAt?: string;
  dueDate?: string;
  status?: string;
  drill: { date: string };
  latestAttempt?: { reviewStatus?: "pending" | "reviewed" };
}): PlanTab {
  const status = getDrillStatus(item);
  if (status !== "completed") return "ongoing";
  if (item.latestAttempt?.reviewStatus === "reviewed") return "reviewed";
  return "completed";
}

export default function DrillsPage() {
  const [activeTab, setActiveTab] = useState<PlanTab>("ongoing");
  const prefetchDrill = usePrefetchDrill();

  const {
    data: drills = [],
    isLoading: loading,
  } = useLearnerDrills({ limit: 100 });

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

  const filteredDrills = drills
    .filter((item) => drillPlanTab(item) === activeTab)
    .sort((a, b) => {
      const dateA = new Date(a.assignedAt || a.drill?.date || 0).getTime();
      const dateB = new Date(b.assignedAt || b.drill?.date || 0).getTime();
      return dateB - dateA;
    });

  const stats = {
    ongoing: drills.filter((d) => drillPlanTab(d) === "ongoing").length,
    reviewed: drills.filter((d) => drillPlanTab(d) === "reviewed").length,
    completed: drills.filter((d) => drillPlanTab(d) === "completed").length,
  };

  const tabLabels: Record<PlanTab, string> = {
    ongoing: "Ongoing",
    reviewed: "Reviewed",
    completed: "Completed",
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100/80">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3 md:max-w-2xl md:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">My Plans</h1>
              <p className="text-sm text-gray-500 mt-0.5">
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

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8 space-y-6">
        <LearnerNextSessionCard session={nextSession} isLoading={classesLoading} />

        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Assigned Drills</h2>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1 mb-4 flex gap-1">
            {(["ongoing", "reviewed", "completed"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-[#22c55e] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span>{tabLabels[tab]}</span>
                {stats[tab] > 0 && (
                  <span
                    className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {stats[tab]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
            </div>
          ) : filteredDrills.length === 0 ? (
            <Card className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No drills found
              </h3>
              <p className="text-gray-500 text-sm">
                {activeTab === "ongoing"
                  ? "You don't have any ongoing drills."
                  : activeTab === "reviewed"
                    ? "No reviewed drills yet."
                    : "You haven't completed any drills yet."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDrills.map((item) => (
                <PlanDrillRow
                  key={item.assignmentId}
                  drill={item.drill}
                  assignmentId={item.assignmentId}
                  dueDate={item.dueDate}
                  completedAt={item.completedAt}
                  status={item.status}
                  onPrefetch={prefetchDrill}
                  onNavigate={() =>
                    trackActivity("drill", item.drill._id, "started", {
                      title: item.drill?.title,
                      drillTitle: item.drill?.title,
                      type: item.drill?.type,
                      assignmentId: item.assignmentId,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
