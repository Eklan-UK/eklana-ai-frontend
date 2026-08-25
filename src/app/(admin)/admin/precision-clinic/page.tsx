"use client";

import { ClinicStudentListView } from "@/components/precision-clinic";

export default function PrecisionClinicPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl">
        <ClinicStudentListView variant="admin" />
      </div>
    </div>
  );
}
