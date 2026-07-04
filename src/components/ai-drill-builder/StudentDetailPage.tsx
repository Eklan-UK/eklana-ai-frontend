"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { StudentContextForm } from "@/components/ai-drill-builder/StudentContextForm";
import { StudentWeeksView } from "@/components/ai-drill-builder/StudentWeeksView";
import { useStudentContext } from "@/hooks/useStudentContext";
import { useTutorStudents } from "@/hooks/useTutor";
import { useAiDrillBuilderLearners } from "@/hooks/useAiDrillBuilderLearners";
import type { StudentContextData } from "@/lib/api";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-drill-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-drill-builder/LearnerAvatar";

interface StudentDetailPageProps {
  variant: "tutor" | "admin";
  studentId: string;
}

export function StudentDetailPage({ variant, studentId }: StudentDetailPageProps) {
  const basePath =
    variant === "tutor" ? "/tutor/ai-drill-builder" : "/admin/ai-drill-builder";
  const listPath = variant === "tutor" ? "/tutor/drills" : "/admin/drills";

  const { data: context, isLoading } = useStudentContext(studentId);
  const [localContext, setLocalContext] = useState<StudentContextData | null>(
    null,
  );
  const [editingContext, setEditingContext] = useState(false);

  const { data: tutorData } = useTutorStudents(
    { limit: 1000 },
    { enabled: variant === "tutor" },
  );
  const { data: adminData } = useAiDrillBuilderLearners(variant === "admin");

  const studentInfo = useMemo(() => {
    if (variant === "tutor") {
      const match = (tutorData?.students ?? []).find(
        (s: Record<string, unknown>) =>
          getLearnerId(s as Parameters<typeof getLearnerId>[0]) === studentId,
      );
      if (!match) return null;
      return {
        name: getLearnerDisplayName(
          match as Parameters<typeof getLearnerDisplayName>[0],
        ),
        email: match.email as string | undefined,
        avatar: match.avatar as string | null | undefined,
        image: match.image as string | null | undefined,
        anchorDate:
          (match.subscriptionActivatedAt as string | undefined) ??
          (match.createdAt as string | undefined),
      };
    }
    const match = (adminData?.learners ?? []).find(
      (s) => getLearnerId(s) === studentId,
    );
    if (!match) return null;
    return {
      name: getLearnerDisplayName(match),
      email: match.email,
      avatar: match.avatar,
      image: match.image,
      anchorDate:
        match.subscriptionActivatedAt ?? match.createdAt ?? undefined,
    };
  }, [variant, tutorData, adminData, studentId]);

  const activeContext = localContext ?? context;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (editingContext) {
    return (
      <div>
        <StudentContextForm
          studentId={studentId}
          initialData={activeContext ?? undefined}
          isEdit
          onSaved={(data) => {
            setLocalContext(data);
            setEditingContext(false);
          }}
          onCancel={() => setEditingContext(false)}
        />
      </div>
    );
  }

  if (!activeContext) {
    return (
      <div>
        <div className="flex items-start gap-4 mb-6">
          {studentInfo && <LearnerAvatar learner={studentInfo} size="lg" />}
          <div>
            <Link
              href={listPath}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to students
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {studentInfo?.name ?? "Student"}
            </h1>
            {studentInfo?.email && (
              <p className="text-sm text-gray-500 mt-0.5">{studentInfo.email}</p>
            )}
          </div>
        </div>
        <StudentContextForm
          studentId={studentId}
          isEdit={false}
          onSaved={(data) => setLocalContext(data)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          {studentInfo && (
            <LearnerAvatar learner={studentInfo} size="lg" />
          )}
          <div>
            <Link
              href={listPath}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to students
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {studentInfo?.name ?? "Student"}
            </h1>
            {studentInfo?.email && (
              <p className="text-sm text-gray-500 mt-0.5">{studentInfo.email}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditingContext(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shrink-0"
        >
          <Pencil className="w-4 h-4" />
          Edit context
        </button>
      </div>

      <StudentWeeksView
        studentId={studentId}
        studentName={studentInfo?.name ?? "Student"}
        basePath={basePath}
        anchorDate={studentInfo?.anchorDate}
      />
    </div>
  );
}
