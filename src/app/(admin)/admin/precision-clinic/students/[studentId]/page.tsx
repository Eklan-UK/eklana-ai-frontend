"use client";

import { use } from "react";
import { ClinicStudentWeeksView } from "@/components/precision-clinic/ClinicStudentWeeksView";

export default function PrecisionClinicStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl">
        <ClinicStudentWeeksView studentId={studentId} />
      </div>
    </div>
  );
}
