"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatWeekDateRange,
  mergeWeeksWithEmptySlots,
  type StudentWeek,
} from "@/lib/ai-drill-builder/week-utils";
import {
  getLearnerDisplayName,
  getLearnerId,
} from "@/lib/ai-drill-builder/learner-utils";
import { LearnerAvatar } from "@/components/ai-drill-builder/LearnerAvatar";
import { Checkbox } from "@/components/ui/Checkbox";
import { useTutorStudents } from "@/hooks/useTutor";
import { useAiDrillBuilderLearners } from "@/hooks/useAiDrillBuilderLearners";
import {
  useCreatePrecisionClinicStudentWeek,
  useDeletePrecisionClinicStudentWeeks,
  usePrecisionClinicStudentWeeks,
} from "@/hooks/usePrecisionClinic";
import { getDrillTypeLabel } from "@/utils/drill";
import { assignmentStatusLabel } from "@/lib/drills/assignment-status";
import { useLearnerClinicEnrollment } from "@/hooks/usePrecisionClinicEnrollments";
import { ClinicEnrollmentModal } from "./ClinicEnrollmentModal";

type ClinicWeekDrill = {
  _id?: string;
  title?: string;
  type?: string;
  drillType?: string;
  difficulty?: string;
  status?: string;
  dueDate?: string | Date | null;
};

interface ClinicStudentWeeksViewProps {
  studentId: string;
  variant?: "admin" | "tutor";
}

export function ClinicStudentWeeksView({
  studentId,
  variant = "admin",
}: ClinicStudentWeeksViewProps) {
  const basePath =
    variant === "tutor"
      ? "/tutor/precision-clinic/students"
      : "/admin/precision-clinic/students";
  const listHref =
    variant === "tutor" ? "/tutor/precision-clinic" : "/admin/precision-clinic";

  const { data, isLoading } = usePrecisionClinicStudentWeeks(studentId);
  const createWeek = useCreatePrecisionClinicStudentWeek(studentId);
  const deleteWeeks = useDeletePrecisionClinicStudentWeeks(studentId);
  const { data: tutorData } = useTutorStudents(
    { limit: 1000 },
    { enabled: variant === "tutor" },
  );
  const { data: adminData } = useAiDrillBuilderLearners(variant === "admin");
  const [expandedPast, setExpandedPast] = useState<Set<number>>(new Set());
  const [selectedWeekNumbers, setSelectedWeekNumbers] = useState<Set<number>>(
    new Set(),
  );
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);
  const { data: enrolled = false } = useLearnerClinicEnrollment(studentId);

  const studentInfo = useMemo(() => {
    if (variant === "tutor") {
      const match = (tutorData?.students ?? []).find(
        (s: Record<string, unknown>) =>
          getLearnerId(s as Parameters<typeof getLearnerId>[0]) === studentId,
      );
      if (!match) {
        return { name: "Student", email: undefined, avatar: null, image: null };
      }
      return {
        name: getLearnerDisplayName(
          match as Parameters<typeof getLearnerDisplayName>[0],
        ),
        email: match.email as string | undefined,
        avatar: match.avatar as string | null | undefined,
        image: match.image as string | null | undefined,
      };
    }
    const match = (adminData?.learners ?? []).find(
      (s) => getLearnerId(s) === studentId,
    );
    if (!match) {
      return { name: "Student", email: undefined, avatar: null, image: null };
    }
    return {
      name: getLearnerDisplayName(match),
      email: match.email,
      avatar: match.avatar,
      image: match.image,
    };
  }, [variant, tutorData, adminData, studentId]);

  const currentWeek = data?.currentWeek ?? 0;

  const weeks = useMemo(() => {
    if (!currentWeek) return [] as StudentWeek[];
    const rawWeeks = (data?.weeks ?? []) as StudentWeek[];
    return mergeWeeksWithEmptySlots(rawWeeks, currentWeek, data?.anchorDate);
  }, [data, currentWeek]);

  const emptyWeekNumbers = useMemo(() => {
    return weeks
      .filter((week) => (week.drills?.length ?? week.items?.length ?? 0) === 0)
      .map((week) => week.weekNumber);
  }, [weeks]);

  const togglePastWeek = (weekNumber: number) => {
    setExpandedPast((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) next.delete(weekNumber);
      else next.add(weekNumber);
      return next;
    });
  };

  const toggleWeekSelected = (weekNumber: number, checked: boolean) => {
    setSelectedWeekNumbers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(weekNumber);
      else next.delete(weekNumber);
      return next;
    });
  };

  const clearSelection = () => setSelectedWeekNumbers(new Set());

  const handleDeleteSelected = async () => {
    const selected = Array.from(selectedWeekNumbers).sort((a, b) => a - b);
    if (selected.length === 0) return;

    const nonEmpty = selected.filter((weekNumber) => {
      const week = weeks.find((w) => w.weekNumber === weekNumber);
      return (week?.drills?.length ?? week?.items?.length ?? 0) > 0;
    });
    if (nonEmpty.length > 0) {
      toast.error(
        `Cannot delete week${nonEmpty.length === 1 ? "" : "s"} ${nonEmpty.join(", ")}: move or remove drills first`,
      );
      return;
    }

    if (selected.length >= weeks.length) {
      toast.error("Cannot delete all weeks; at least one week must remain");
      return;
    }

    const label =
      selected.length === 1
        ? `Week ${selected[0]}`
        : `${selected.length} empty weeks (${selected.join(", ")})`;
    if (
      !confirm(
        `Delete ${label}? Remaining weeks will be renumbered to stay consecutive.`,
      )
    ) {
      return;
    }

    try {
      await deleteWeeks.mutateAsync({ weekNumbers: selected });
      clearSelection();
    } catch {
      // Toast handled by mutation onError
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const selectedCount = selectedWeekNumbers.size;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <LearnerAvatar learner={studentInfo} size="lg" />
          <div>
            <Link
              href={listHref}
              className="mb-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to students
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
              {studentInfo.name}
            </h1>
            {studentInfo.email ? (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-muted-foreground">
                {studentInfo.email}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnrollmentModalOpen(true)}
          className={`inline-flex items-center gap-2 self-start rounded-xl border px-4 py-2 text-sm font-medium transition-colors sm:self-auto ${
            enrolled
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground"
          }`}
        >
          {enrolled ? "Enrolled" : "Locked"}
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          Weekly work for{" "}
          <span className="font-medium text-gray-900 dark:text-foreground">
            {studentInfo.name}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <>
              <button
                type="button"
                onClick={clearSelection}
                disabled={deleteWeeks.isPending}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-border dark:bg-card dark:text-muted-foreground"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSelected()}
                disabled={deleteWeeks.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteWeeks.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete {selectedCount} week{selectedCount === 1 ? "" : "s"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => createWeek.mutate()}
            disabled={createWeek.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createWeek.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            + Week
          </button>
        </div>
      </div>

      {emptyWeekNumbers.length > 0 ? (
        <p className="text-xs text-gray-400">
          Select empty weeks to delete them. Weeks with drills must be cleared
          first.
        </p>
      ) : null}

      {weeks.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 dark:border-border dark:bg-card dark:text-muted-foreground">
          No weeks available yet. Use + Week to create week 1.
        </div>
      ) : (
        <div className="space-y-4">
          {weeks
            .slice()
            .reverse()
            .map((week) => {
              const isCurrent = week.weekNumber === currentWeek;
              const isPast = week.weekNumber < currentWeek;
              const isCollapsed = isPast && !expandedPast.has(week.weekNumber);
              const weekDrills = (week.drills ?? []) as ClinicWeekDrill[];
              const drillCount = weekDrills.length;
              const isEmpty = drillCount === 0;
              const isSelected = selectedWeekNumbers.has(week.weekNumber);
              const dateRange = formatWeekDateRange(
                week.weekNumber,
                data?.anchorDate,
              );

              return (
                <div
                  key={week.weekNumber}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-card ${
                    isSelected
                      ? "border-red-200 ring-1 ring-red-100"
                      : isCurrent
                        ? "border-emerald-200 ring-1 ring-emerald-100 dark:border-emerald-800"
                        : "border-gray-100 dark:border-border"
                  }`}
                >
                  <div className="flex items-center">
                    <div className="shrink-0 py-4 pl-4">
                      <Checkbox
                        checked={isSelected}
                        disabled={!isEmpty || deleteWeeks.isPending}
                        onChange={(e) =>
                          toggleWeekSelected(week.weekNumber, e.target.checked)
                        }
                        aria-label={
                          isEmpty
                            ? `Select week ${week.weekNumber} for deletion`
                            : `Week ${week.weekNumber} has drills and cannot be deleted`
                        }
                        title={
                          isEmpty
                            ? "Select empty week to delete"
                            : "Move or remove drills before deleting this week"
                        }
                        className="rounded border-gray-300 disabled:opacity-40"
                      />
                    </div>
                    {isPast ? (
                      <button
                        type="button"
                        onClick={() => togglePastWeek(week.weekNumber)}
                        className="px-2 py-4 text-gray-400 hover:text-gray-600"
                        aria-label={
                          isCollapsed ? "Expand week" : "Collapse week"
                        }
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                    ) : null}
                    <Link
                      href={`${basePath}/${studentId}/week/${week.weekNumber}`}
                      className={`flex flex-1 items-center justify-between px-4 py-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-muted/30 ${
                        isPast ? "pl-0" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                            isCurrent
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground"
                          }`}
                        >
                          W{week.weekNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-foreground">
                              Week {week.weekNumber}
                            </h3>
                            {isCurrent ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                Current
                              </span>
                            ) : null}
                            {isEmpty ? (
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 dark:border-border dark:bg-muted dark:text-muted-foreground">
                                Empty
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500 dark:text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {dateRange}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-muted-foreground">
                          {drillCount} drill{drillCount !== 1 ? "s" : ""}
                        </span>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </Link>
                  </div>

                  {!isCollapsed && drillCount > 0 ? (
                    <div className="border-t border-gray-50 px-4 pb-4 dark:border-border">
                      <ul className="mt-3 space-y-2">
                        {weekDrills.slice(0, 3).map((drill, idx) => (
                          <li
                            key={String(drill._id ?? idx)}
                            className="flex min-w-0 items-center gap-2 text-sm text-gray-600 dark:text-muted-foreground"
                          >
                            <span className="shrink-0">
                              {getDrillTypeLabel(drill.drillType ?? drill.type)}
                            </span>
                            {drill.title ? (
                              <>
                                <span className="shrink-0 text-gray-300">·</span>
                                <span className="truncate" title={drill.title}>
                                  {drill.title}
                                </span>
                              </>
                            ) : null}
                            {drill.difficulty ? (
                              <>
                                <span className="shrink-0 text-gray-300">·</span>
                                <span className="shrink-0 capitalize">
                                  {drill.difficulty}
                                </span>
                              </>
                            ) : null}
                            {drill.status ? (
                              <>
                                <span className="shrink-0 text-gray-300">·</span>
                                <span className="shrink-0">
                                  {assignmentStatusLabel({
                                    status: drill.status,
                                    dueDate: drill.dueDate,
                                  })}
                                </span>
                              </>
                            ) : null}
                          </li>
                        ))}
                        {drillCount > 3 ? (
                          <li className="text-xs text-gray-400">
                            +{drillCount - 3} more
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      )}

      {enrollmentModalOpen && (
        <ClinicEnrollmentModal
          variant={variant}
          initialStudentId={studentId}
          onClose={() => setEnrollmentModalOpen(false)}
        />
      )}
    </div>
  );
}
