"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { WeekDrillList } from "@/components/ai-user-builder/WeekDrillList";
import { AIGeneratedPreview } from "@/components/drills/AIGeneratedPreview";
import { AIDrillCreationShell } from "@/components/drills/AIDrillCreationShell";
import {
  useAIDrillCreationWorkflow,
  storePendingAiDrillApply,
} from "@/hooks/useAIDrillCreationWorkflow";
import { useStudentContext } from "@/hooks/useStudentContext";
import { useStudentWeeks } from "@/hooks/useStudentWeeks";
import { useTutorStudents } from "@/hooks/useTutor";
import { useAiUserBuilderLearners } from "@/hooks/useAiUserBuilderLearners";
import { formatWeekDateRange } from "@/lib/ai-user-builder/week-utils";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-user-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-user-builder/LearnerAvatar";
import type { AiStudentOption } from "@/components/drills/AIGenerationForm";

interface WeekDetailPageProps {
  variant: "tutor" | "admin";
  studentId: string;
  weekNumber: number;
}

export function WeekDetailPage({
  variant,
  studentId,
  weekNumber,
}: WeekDetailPageProps) {
  const router = useRouter();
  const basePath =
    variant === "tutor" ? "/tutor/ai-user-builder" : "/admin/ai-user-builder";
  const builderPath =
    variant === "tutor" ? "/tutor/drills/create" : "/admin/drills/create";
  const drillDetailBasePath =
    variant === "tutor" ? "/tutor/drills" : "/admin/drills";

  const { data: weeksData, isLoading: weeksLoading } =
    useStudentWeeks(studentId);
  const { data: studentContext } = useStudentContext(studentId);

  const { data: tutorData, isLoading: tutorStudentsLoading } = useTutorStudents(
    { limit: 1000 },
    { enabled: variant === "tutor" },
  );
  const { data: adminData, isLoading: adminStudentsLoading } =
    useAiUserBuilderLearners(variant === "admin");

  const loadingStudents =
    variant === "tutor" ? tutorStudentsLoading : adminStudentsLoading;

  const studentInfo = useMemo(() => {
    if (variant === "tutor") {
      const match = (tutorData?.students ?? []).find(
        (s: Record<string, unknown>) =>
          getLearnerId(s as Parameters<typeof getLearnerId>[0]) === studentId,
      );
      if (!match) return { name: "Student" };
      return {
        name: getLearnerDisplayName(
          match as Parameters<typeof getLearnerDisplayName>[0],
        ),
        avatar: match.avatar as string | null | undefined,
        image: match.image as string | null | undefined,
      };
    }
    const match = (adminData?.learners ?? []).find(
      (s) => getLearnerId(s) === studentId,
    );
    if (!match) return { name: "Student" };
    return {
      name: getLearnerDisplayName(match),
      avatar: match.avatar,
      image: match.image,
    };
  }, [variant, tutorData, adminData, studentId]);

  const aiStudentOptions: AiStudentOption[] = useMemo(() => {
    if (variant === "tutor") {
      return (tutorData?.students ?? [])
        .map((user: Record<string, unknown>) => {
          const id = getLearnerId(user as Parameters<typeof getLearnerId>[0]);
          if (!id) return null;
          return {
            id,
            label: getLearnerDisplayName(
              user as Parameters<typeof getLearnerDisplayName>[0],
            ),
            email: user.email as string | undefined,
          };
        })
        .filter((o): o is NonNullable<typeof o> => o !== null);
    }
    return (adminData?.learners ?? [])
      .map((user) => {
        const id = getLearnerId(user);
        if (!id) return null;
        return {
          id,
          label: getLearnerDisplayName(user),
          email: user.email,
        };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);
  }, [variant, tutorData, adminData]);

  const week = useMemo(() => {
    return (weeksData?.weeks ?? []).find((w) => w.weekNumber === weekNumber);
  }, [weeksData, weekNumber]);

  const dateRange = formatWeekDateRange(weekNumber, weeksData?.anchorDate);
  const returnTo = `${basePath}/${studentId}/week/${weekNumber}`;

  const initialContext = useMemo(
    () => ({
      studentId,
      weekNumber,
      studentContext,
      anchorDate: weeksData?.anchorDate,
    }),
    [studentId, weekNumber, studentContext, weeksData?.anchorDate],
  );

  const lockedStudentIds = useMemo(() => [studentId], [studentId]);

  const aiWorkflow = useAIDrillCreationWorkflow({
    students: aiStudentOptions,
    initialContext,
    lockedStudentIds,
    onApplyParsedContent: () => {},
    onNavigateToBuilder: (pending) => {
      storePendingAiDrillApply(pending);
      const params = new URLSearchParams({
        student: studentId,
        week: String(weekNumber),
        returnTo,
      });
      router.push(`${builderPath}?${params.toString()}`);
    },
  });

  if (weeksLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`${basePath}/${studentId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to weeks
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Week {weekNumber} · {dateRange}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <LearnerAvatar learner={studentInfo} size="sm" />
          <p className="text-sm text-gray-500">
            Student: {studentInfo.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          {aiWorkflow.showAiPreview && aiWorkflow.aiGeneratedContent && (
            <AIGeneratedPreview
              drillType={aiWorkflow.aiDrillType}
              content={aiWorkflow.aiGeneratedContent}
              onUseDrill={aiWorkflow.handleUseAiDrill}
            />
          )}

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Drills this week
            </h2>
            <WeekDrillList
              drills={week?.drills ?? week?.items ?? []}
              drillDetailBasePath={drillDetailBasePath}
            />
          </div>

          <button
            type="button"
            onClick={() => aiWorkflow.setShowAiFormModal(true)}
            className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Create Drill
          </button>
        </div>
      </div>

      <AIDrillCreationShell
        showAiFormModal={aiWorkflow.showAiFormModal}
        setShowAiFormModal={aiWorkflow.setShowAiFormModal}
        aiFormValues={aiWorkflow.aiFormValues}
        handleAiFormChange={aiWorkflow.handleAiFormChange}
        setAiStudentIds={aiWorkflow.setAiStudentIds}
        students={aiWorkflow.students}
        loadingStudents={loadingStudents}
        isGeneratingDrill={aiWorkflow.isGeneratingDrill}
        handleAIGenerate={aiWorkflow.handleAIGenerate}
        lockedStudentIds={aiWorkflow.lockedStudentIds}
        showAiPreview={false}
        aiDrillType={aiWorkflow.aiDrillType}
        aiGeneratedContent={aiWorkflow.aiGeneratedContent}
        handleUseAiDrill={aiWorkflow.handleUseAiDrill}
        showChatSidebar={aiWorkflow.showChatSidebar}
        setShowChatSidebar={aiWorkflow.setShowChatSidebar}
        setAiGeneratedContent={aiWorkflow.setAiGeneratedContent}
        setShowAiPreview={aiWorkflow.setShowAiPreview}
      />
    </div>
  );
}
