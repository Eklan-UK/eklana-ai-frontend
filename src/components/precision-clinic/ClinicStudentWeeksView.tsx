"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
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
import { useAiDrillBuilderLearners } from "@/hooks/useAiDrillBuilderLearners";
import {
  useCreatePrecisionClinicStudentWeek,
  usePrecisionClinicStudentWeeks,
} from "@/hooks/usePrecisionClinic";
import { getDrillTypeLabel } from "@/utils/drill";

const BASE_PATH = "/admin/precision-clinic/students";

type ClinicWeekDrill = {
  _id?: string;
  title?: string;
  type?: string;
  difficulty?: string;
};

interface ClinicStudentWeeksViewProps {
  studentId: string;
}

export function ClinicStudentWeeksView({ studentId }: ClinicStudentWeeksViewProps) {
  const { data, isLoading } = usePrecisionClinicStudentWeeks(studentId);
  const createWeek = useCreatePrecisionClinicStudentWeek(studentId);
  const { data: adminData } = useAiDrillBuilderLearners(true);
  const [expandedPast, setExpandedPast] = useState<Set<number>>(new Set());

  const studentInfo = useMemo(() => {
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
  }, [adminData, studentId]);

  const currentWeek = data?.currentWeek ?? 0;

  const weeks = useMemo(() => {
    if (!currentWeek) return [] as StudentWeek[];
    const rawWeeks = (data?.weeks ?? []) as StudentWeek[];
    return mergeWeeksWithEmptySlots(rawWeeks, currentWeek, data?.anchorDate);
  }, [data, currentWeek]);

  const togglePastWeek = (weekNumber: number) => {
    setExpandedPast((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) next.delete(weekNumber);
      else next.add(weekNumber);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start gap-4">
        <LearnerAvatar learner={studentInfo} size="lg" />
        <div>
          <Link
            href="/admin/precision-clinic"
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          Weekly work for{" "}
          <span className="font-medium text-gray-900 dark:text-foreground">
            {studentInfo.name}
          </span>
        </p>
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
              const dateRange = formatWeekDateRange(
                week.weekNumber,
                data?.anchorDate,
              );

              return (
                <div
                  key={week.weekNumber}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-card ${
                    isCurrent
                      ? "border-emerald-200 ring-1 ring-emerald-100 dark:border-emerald-800"
                      : "border-gray-100 dark:border-border"
                  }`}
                >
                  <div className="flex items-center">
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
                      href={`${BASE_PATH}/${studentId}/week/${week.weekNumber}`}
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
                              {getDrillTypeLabel(drill.type)}
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
    </div>
  );
}
