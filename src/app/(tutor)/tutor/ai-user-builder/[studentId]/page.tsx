"use client";

import { Header } from "@/components/layout/Header";
import { StudentDetailPage } from "@/components/ai-user-builder/StudentDetailPage";
import { use } from "react";

export default function TutorAiUserBuilderStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6" />
      <Header title="AI User Builder" />
      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        <StudentDetailPage variant="tutor" studentId={studentId} />
      </div>
    </div>
  );
}
