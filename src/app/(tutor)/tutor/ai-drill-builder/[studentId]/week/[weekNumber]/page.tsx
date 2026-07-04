"use client";

import { Header } from "@/components/layout/Header";
import { WeekDetailPage } from "@/components/ai-drill-builder/WeekDetailPage";
import { use } from "react";

export default function TutorAiDrillBuilderWeekPage({
  params,
}: {
  params: Promise<{ studentId: string; weekNumber: string }>;
}) {
  const { studentId, weekNumber } = use(params);
  const week = parseInt(weekNumber, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Drill Builder" />
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8">
        <WeekDetailPage
          variant="tutor"
          studentId={studentId}
          weekNumber={Number.isFinite(week) ? week : 1}
        />
      </div>
    </div>
  );
}
