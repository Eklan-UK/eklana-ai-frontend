"use client";

import { use } from "react";
import { Header } from "@/components/layout/Header";
import { ClinicStudentWeeksView } from "@/components/precision-clinic/ClinicStudentWeeksView";

export default function TutorPrecisionClinicStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Precision Clinic" />
      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        <ClinicStudentWeeksView variant="tutor" studentId={studentId} />
      </div>
    </div>
  );
}
