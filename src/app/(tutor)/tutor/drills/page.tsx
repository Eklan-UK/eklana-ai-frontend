"use client";

import { Header } from "@/components/layout/Header";
import { StudentListPage } from "@/components/ai-drill-builder/StudentListPage";

export default function TutorDrillsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="Drill Builder" />
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8">
        <p className="text-sm text-gray-500 mb-6">
          Select a student to view their weekly plan and create personalized
          drills with AI.
        </p>
        <StudentListPage variant="tutor" />
      </div>
    </div>
  );
}
