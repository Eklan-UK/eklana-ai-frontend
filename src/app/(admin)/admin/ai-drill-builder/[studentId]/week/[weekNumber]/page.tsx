"use client";

import { WeekDetailPage } from "@/components/ai-drill-builder/WeekDetailPage";
import { use } from "react";

export default function AdminAiDrillBuilderWeekPage({
  params,
}: {
  params: Promise<{ studentId: string; weekNumber: string }>;
}) {
  const { studentId, weekNumber } = use(params);
  const week = parseInt(weekNumber, 10);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-6">
          Drill Builder
        </h1>
        <WeekDetailPage
          variant="admin"
          studentId={studentId}
          weekNumber={Number.isFinite(week) ? week : 1}
        />
      </div>
    </div>
  );
}
