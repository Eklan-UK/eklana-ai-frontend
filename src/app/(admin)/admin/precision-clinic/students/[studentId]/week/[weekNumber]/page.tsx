"use client";

import { use } from "react";
import { ClinicStudentWeekDetailView } from "@/components/precision-clinic/ClinicStudentWeekDetailView";

export default function PrecisionClinicStudentWeekPage({
  params,
}: {
  params: Promise<{ studentId: string; weekNumber: string }>;
}) {
  const { studentId, weekNumber } = use(params);
  const week = parseInt(weekNumber, 10);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl">
        <ClinicStudentWeekDetailView
          studentId={studentId}
          weekNumber={Number.isFinite(week) ? week : 1}
        />
      </div>
    </div>
  );
}
