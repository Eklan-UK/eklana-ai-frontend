"use client";

import { Header } from "@/components/layout/Header";
import { ClinicStudentListView } from "@/components/precision-clinic";

export default function TutorPrecisionClinicPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Precision Clinic" />
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8">
        <ClinicStudentListView variant="tutor" />
      </div>
    </div>
  );
}
