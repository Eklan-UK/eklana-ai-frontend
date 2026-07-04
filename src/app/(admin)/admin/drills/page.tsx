"use client";

import { StudentListPage } from "@/components/ai-drill-builder/StudentListPage";

export default function AdminDrillsPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">
          Drill Builder
        </h1>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mb-6">
          Select a learner to view their weekly plan and create personalized
          drills with AI.
        </p>
        <StudentListPage variant="admin" />
      </div>
    </div>
  );
}
