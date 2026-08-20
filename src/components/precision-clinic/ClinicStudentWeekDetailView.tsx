"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import {
  invalidatePrecisionClinicStudentWeeks,
  useMovePrecisionClinicStudentWeekDrills,
  usePrecisionClinicStudentWeeks,
} from "@/hooks/usePrecisionClinic";
import { useAiDrillBuilderLearners } from "@/hooks/useAiDrillBuilderLearners";
import {
  formatWeekDateRange,
  type WeekDrillItem,
} from "@/lib/ai-drill-builder/week-utils";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-drill-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-drill-builder/LearnerAvatar";
import { WeekDrillList } from "@/components/ai-drill-builder/WeekDrillList";

interface ClinicStudentWeekDetailViewProps {
  studentId: string;
  weekNumber: number;
}

function toWeekDrillItem(raw: Record<string, unknown>): WeekDrillItem {
  return {
    assignmentId: raw.assignmentId != null ? String(raw.assignmentId) : undefined,
    drillId: raw.drillId != null ? String(raw.drillId) : null,
    title: (raw.title as string | null | undefined) ?? null,
    type: (raw.type as string | null | undefined) ?? null,
    drillType: (raw.drillType as string | null | undefined) ?? null,
    difficulty: (raw.difficulty as string | null | undefined) ?? null,
    topic: (raw.topic as string | null | undefined) ?? null,
    part: (raw.part as string | null | undefined) ?? null,
    status: (raw.status as string | undefined) ?? "pending",
    isActive: typeof raw.isActive === "boolean" ? raw.isActive : true,
    isBookmarked: Boolean(raw.isBookmarked),
    assignedAt:
      raw.assignedAt != null
        ? typeof raw.assignedAt === "string"
          ? raw.assignedAt
          : new Date(raw.assignedAt as Date).toISOString()
        : undefined,
    dueDate:
      raw.dueDate != null
        ? typeof raw.dueDate === "string"
          ? raw.dueDate
          : new Date(raw.dueDate as Date).toISOString()
        : null,
    completedAt:
      raw.completedAt != null
        ? typeof raw.completedAt === "string"
          ? raw.completedAt
          : new Date(raw.completedAt as Date).toISOString()
        : null,
  };
}

export function ClinicStudentWeekDetailView({
  studentId,
  weekNumber,
}: ClinicStudentWeekDetailViewProps) {
  const { data: weeksData, isLoading: weeksLoading } =
    usePrecisionClinicStudentWeeks(studentId);
  const moveDrills = useMovePrecisionClinicStudentWeekDrills(studentId);
  const { data: adminData } = useAiDrillBuilderLearners(true);

  const studentInfo = useMemo(() => {
    const match = (adminData?.learners ?? []).find(
      (s) => getLearnerId(s) === studentId,
    );
    if (!match) return { name: "Student", avatar: null, image: null };
    return {
      name: getLearnerDisplayName(match),
      avatar: match.avatar,
      image: match.image,
    };
  }, [adminData, studentId]);

  const week = useMemo(() => {
    return (weeksData?.weeks ?? []).find((w) => w.weekNumber === weekNumber);
  }, [weeksData, weekNumber]);

  const drills = useMemo(() => {
    const raw = (week?.drills ?? []) as Record<string, unknown>[];
    return raw.map(toWeekDrillItem);
  }, [week]);

  const dateRange = formatWeekDateRange(weekNumber, weeksData?.anchorDate);
  const returnTo = `/admin/precision-clinic/students/${studentId}/week/${weekNumber}`;
  const createHref = `/admin/drills/create?student=${encodeURIComponent(studentId)}&week=${weekNumber}&source=precision_clinic&returnTo=${encodeURIComponent(returnTo)}`;
  const backHref = `/admin/precision-clinic/students/${studentId}`;

  if (weeksLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-muted-foreground dark:hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to weeks
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
              Week {weekNumber} · {dateRange}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <LearnerAvatar learner={studentInfo} size="sm" />
              <p className="text-sm text-gray-500 dark:text-muted-foreground">
                Student: {studentInfo.name}
              </p>
            </div>
          </div>
        </div>
        <Link
          href={createHref}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#418b43] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a7c3b]"
        >
          <Plus className="h-4 w-4" />
          Create Clinic Drill
        </Link>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-foreground">
          Drills this week
        </h2>
        <WeekDrillList
          drills={drills}
          drillDetailBasePath="/admin/drills"
          returnTo={returnTo}
          studentId={studentId}
          currentWeekNumber={weekNumber}
          currentWeek={weeksData?.currentWeek ?? weekNumber}
          enableMove={true}
          moveDrills={moveDrills}
          invalidate={invalidatePrecisionClinicStudentWeeks}
          createQueryParams={{
            student: studentId,
            week: String(weekNumber),
            source: "precision_clinic",
          }}
        />
      </div>
    </div>
  );
}
