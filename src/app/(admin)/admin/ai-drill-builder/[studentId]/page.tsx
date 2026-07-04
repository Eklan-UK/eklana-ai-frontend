"use client";

import { StudentDetailPage } from "@/components/ai-drill-builder/StudentDetailPage";
import { use } from "react";

export default function AdminAiDrillBuilderStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-6">
          Drill Builder
        </h1>
        <StudentDetailPage variant="admin" studentId={studentId} />
      </div>
    </div>
  );
}
