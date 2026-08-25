"use client";

import { use } from "react";
import { Header } from "@/components/layout/Header";
import { ClinicStudentWeekDetailView } from "@/components/precision-clinic/ClinicStudentWeekDetailView";

export default function TutorPrecisionClinicStudentWeekPage({
  params,
}: {
  params: Promise<{ studentId: string; weekNumber: string }>;
}) {
  const { studentId, weekNumber } = use(params);
  const week = parseInt(weekNumber, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Precision Clinic" />
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8">
        <ClinicStudentWeekDetailView
          variant="tutor"
          studentId={studentId}
          weekNumber={Number.isFinite(week) ? week : 1}
        />
      </div>
    </div>
  );
}
