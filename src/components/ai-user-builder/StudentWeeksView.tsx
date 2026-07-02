"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  computeCurrentWeek,
  formatWeekDateRange,
  mergeWeeksWithEmptySlots,
  type StudentWeek,
} from "@/lib/ai-user-builder/week-utils";
import { useStudentWeeks } from "@/hooks/useStudentWeeks";

interface StudentWeeksViewProps {
  studentId: string;
  studentName: string;
  basePath: string;
  anchorDate?: string | null;
}

export function StudentWeeksView({
  studentId,
  studentName,
  basePath,
  anchorDate,
}: StudentWeeksViewProps) {
  const { data, isLoading } = useStudentWeeks(studentId);
  const [expandedPast, setExpandedPast] = useState<Set<number>>(new Set());

  const currentWeek = useMemo(() => {
    if (data?.currentWeek) return data.currentWeek;
    return computeCurrentWeek(data?.anchorDate ?? anchorDate);
  }, [data, anchorDate]);

  const weeks = useMemo(() => {
    const rawWeeks = (data?.weeks ?? []) as StudentWeek[];
    return mergeWeeksWithEmptySlots(
      rawWeeks,
      currentWeek,
      data?.anchorDate ?? anchorDate,
    );
  }, [data, currentWeek, anchorDate]);

  const togglePastWeek = (weekNumber: number) => {
    setExpandedPast((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Weekly work for <span className="font-medium text-gray-900">{studentName}</span>
      </p>

      {weeks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
          No weeks available yet.
        </div>
      ) : (
        weeks
          .slice()
          .reverse()
          .map((week) => {
            const isCurrent = week.weekNumber === currentWeek;
            const isPast = week.weekNumber < currentWeek;
            const isCollapsed = isPast && !expandedPast.has(week.weekNumber);
            const drillCount = week.drills?.length ?? week.items?.length ?? 0;
            const dateRange =
              week.weekStartDate && week.weekEndDate
                ? formatWeekDateRange(
                    week.weekNumber,
                    data?.anchorDate ?? anchorDate,
                  )
                : formatWeekDateRange(
                    week.weekNumber,
                    data?.anchorDate ?? anchorDate,
                  );

            return (
              <div
                key={week.weekNumber}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  isCurrent
                    ? "border-emerald-200 ring-1 ring-emerald-100"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-center">
                  {isPast && (
                    <button
                      type="button"
                      onClick={() => togglePastWeek(week.weekNumber)}
                      className="px-4 py-4 text-gray-400 hover:text-gray-600"
                      aria-label={
                        isCollapsed ? "Expand week" : "Collapse week"
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <Link
                    href={`${basePath}/${studentId}/week/${week.weekNumber}`}
                    className={`flex-1 flex items-center justify-between px-4 py-4 ${
                      isPast && !isCurrent ? "pl-0" : ""
                    } hover:bg-gray-50/50 transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                          isCurrent
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        W{week.weekNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            Week {week.weekNumber}
                          </h3>
                          {isCurrent && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {dateRange}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {drillCount} drill{drillCount !== 1 ? "s" : ""}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                </div>

                {!isCollapsed && drillCount > 0 && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    <ul className="mt-3 space-y-2">
                      {(week.drills ?? week.items ?? []).slice(0, 3).map(
                        (drill, idx) => (
                          <li
                            key={drill.assignmentId ?? idx}
                            className="text-sm text-gray-600 flex items-center gap-2"
                          >
                            <span className="capitalize">
                              {drill.drillType ?? drill.type ?? "drill"}
                            </span>
                            {drill.difficulty && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="capitalize">
                                  {drill.difficulty}
                                </span>
                              </>
                            )}
                            {drill.status && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="capitalize">
                                  {drill.status}
                                </span>
                              </>
                            )}
                          </li>
                        ),
                      )}
                      {drillCount > 3 && (
                        <li className="text-xs text-gray-400">
                          +{drillCount - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
}
