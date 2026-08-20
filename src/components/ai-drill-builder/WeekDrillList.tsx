"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Edit, Trash2, Loader2, ChevronRight, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { getDrillIcon } from "@/utils/drill";
import { appendReturnTo } from "@/lib/drill-list-filters";
import {
  invalidateStudentWeeks,
  useMoveStudentWeekDrills,
} from "@/hooks/useStudentWeeks";
import { AssignedStudentsModal } from "@/components/drills/AssignedStudentsModal";
import { AdminDrillBookmarkButton } from "@/components/admin/AdminDrillBookmarkButton";
import { Checkbox } from "@/components/ui/Checkbox";
import type { WeekDrillItem } from "@/lib/ai-drill-builder/week-utils";
import { getAssignmentStatusDisplay } from "@/lib/drills/assignment-status";

// Matches the "Saved" badge styling used in TutorDrillCard for drills that
// still need a tutor/admin to select users and update/assign them.
const SAVED_BADGE_CLASS = "bg-amber-50 text-amber-700 border-amber-200";

/** ~5 option rows for the move-target week list. */
const WEEK_PICKER_MAX_HEIGHT_CLASS = "max-h-[13.75rem]";

interface WeekDrillListProps {
  drills: WeekDrillItem[];
  drillDetailBasePath: string;
  returnTo: string;
  /** Student whose weekly drill breakdown should be refreshed after a delete. */
  studentId: string;
  /** Week currently being viewed. */
  currentWeekNumber: number;
  /** Highest existing week slot for this student (1..currentWeek). */
  currentWeek: number;
  /**
   * When false, hides select-all / move-to-week UI and the sticky bottom bar /
   * move dialog. Defaults to true for AI Drill Builder callers.
   */
  enableMove?: boolean;
  /**
   * Invalidation helper after delete / bookmark toggle. Defaults to the
   * general Drill Builder student-weeks invalidator.
   */
  invalidate?: (queryClient: QueryClient, studentId: string) => Promise<void>;
  /**
   * Injectable move mutation so Precision Clinic can use its own API.
   * Defaults to the Drill Builder `useMoveStudentWeekDrills` hook.
   */
  moveDrills?: {
    mutateAsync: (data: {
      assignmentIds: string[];
      targetWeekNumber: number;
    }) => Promise<unknown>;
    isPending: boolean;
  };
  /**
   * Extra query params on the Edit (`…/create?drillId=`) link so callers like
   * Precision Clinic can preserve source/student/week context.
   */
  createQueryParams?: Record<string, string>;
}

export function WeekDrillList({
  drills,
  drillDetailBasePath,
  returnTo,
  studentId,
  currentWeekNumber,
  currentWeek,
  enableMove = true,
  invalidate = invalidateStudentWeeks,
  moveDrills: moveDrillsProp,
  createQueryParams,
}: WeekDrillListProps) {
  const queryClient = useQueryClient();
  const defaultMoveDrills = useMoveStudentWeekDrills(studentId);
  const moveDrills = moveDrillsProp ?? defaultMoveDrills;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetWeekNumber, setTargetWeekNumber] = useState<number | "">("");
  const [viewingAssignedDrill, setViewingAssignedDrill] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const selectableAssignmentIds = useMemo(
    () =>
      enableMove
        ? drills
            .map((d) => (d.assignmentId ? String(d.assignmentId) : null))
            .filter((id): id is string => Boolean(id))
        : [],
    [drills, enableMove],
  );

  // Every open week slot (1..currentWeek) except the source week being viewed.
  const availableWeeks = useMemo(() => {
    const openWeekCount = Math.max(1, Math.floor(currentWeek || 1));
    const weeks: number[] = [];
    for (let w = 1; w <= openWeekCount; w++) {
      if (w !== currentWeekNumber) weeks.push(w);
    }
    return weeks;
  }, [currentWeek, currentWeekNumber]);

  const clearSelection = () => setSelectedIds(new Set());

  const toggleSelected = (assignmentId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(assignmentId);
      else next.delete(assignmentId);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(selectableAssignmentIds) : new Set());
  };

  const openMoveDialog = () => {
    setTargetWeekNumber(availableWeeks[0] ?? "");
    setShowMoveDialog(true);
  };

  const handleMoveConfirm = async () => {
    if (typeof targetWeekNumber !== "number") {
      toast.error("Select a target week");
      return;
    }
    const assignmentIds = Array.from(selectedIds);
    if (assignmentIds.length === 0) return;

    try {
      await moveDrills.mutateAsync({
        assignmentIds,
        targetWeekNumber,
      });
      clearSelection();
      setShowMoveDialog(false);
    } catch {
      // Toast handled by mutation onError
    }
  };

  if (drills.length === 0) {
    return (
      <div className="bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          No drills assigned for this week yet.
        </p>
      </div>
    );
  }

  const handleDelete = async (drillId: string, title?: string | null) => {
    // Same confirm + delete flow as the Old Drill Builder (drillAPI.delete).
    if (
      !confirm(
        `Are you sure you want to delete "${title || "this drill"}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(drillId);
    try {
      await drillAPI.delete(drillId);
      toast.success("Drill deleted successfully");
      await invalidate(queryClient, studentId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete drill: " + message);
    } finally {
      setDeletingId(null);
    }
  };

  const selectedCount = selectedIds.size;
  const allSelectableSelected =
    selectableAssignmentIds.length > 0 &&
    selectableAssignmentIds.every((id) => selectedIds.has(id));

  return (
    <div
      className={`space-y-3 ${enableMove && selectedCount > 0 ? "pb-20" : ""}`}
    >
      {enableMove && selectableAssignmentIds.length > 0 && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelectableSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                aria-label="Select all drills"
                className="rounded border-gray-300 shrink-0"
              />
              <span className="text-xs text-gray-500">
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : "Select all"}
              </span>
            </div>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={openMoveDialog}
                  disabled={availableWeeks.length === 0}
                  className="px-3 py-1.5 text-sm font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    availableWeeks.length === 0
                      ? "Add another week before moving drills"
                      : "Move selected drills to another week"
                  }
                >
                  Move to week
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {drills.map((drill) => {
        const drillType = drill.drillType ?? drill.type ?? "drill";
        const { label: statusLabel, className: statusClass } =
          getAssignmentStatusDisplay("weekList", {
            status: drill.status,
            dueDate: drill.dueDate,
          });
        // Saved drills (is_active: false) still need a tutor/admin to select
        // users and update/assign them, so surface that alongside the status.
        const isSaved = drill.isActive === false;
        const drillId = drill.drillId ? String(drill.drillId) : null;
        const assignmentId = drill.assignmentId
          ? String(drill.assignmentId)
          : null;
        const key = assignmentId ?? drillId ?? drill.title ?? drillType;
        const isSelected =
          enableMove && assignmentId ? selectedIds.has(assignmentId) : false;

        const infoBlock = (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl shrink-0" aria-hidden>
              {getDrillIcon(drillType)}
            </span>
            <div className="min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {drill.title ?? "Untitled Drill"}
              </h4>
              {drill.topic && (
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {drill.topic}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                  {drillType}
                </span>
                {drill.difficulty && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                    {drill.difficulty}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusClass}`}
                >
                  {statusLabel}
                </span>
                {isSaved && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${SAVED_BADGE_CLASS}`}
                    title="This drill was saved but still needs users selected and to be updated/assigned"
                  >
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        );

        return (
          <div
            key={key}
            className={`flex items-center justify-between gap-4 p-4 bg-white rounded-xl border transition-colors ${
              isSelected
                ? "border-amber-200 bg-amber-50/40"
                : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {enableMove && assignmentId && (
                <Checkbox
                  checked={isSelected}
                  onChange={(e) =>
                    toggleSelected(assignmentId, e.target.checked)
                  }
                  aria-label={`Select ${drill.title ?? "drill"}`}
                  className="rounded border-gray-300 shrink-0"
                />
              )}
              {drillId ? (
                <Link
                  href={appendReturnTo(
                    `${drillDetailBasePath}/${drillId}`,
                    returnTo,
                  )}
                  className="min-w-0 flex-1"
                >
                  {infoBlock}
                </Link>
              ) : (
                infoBlock
              )}
            </div>

            {drillId && (
              <div className="flex items-center gap-1 shrink-0">
                <AdminDrillBookmarkButton
                  drillId={drillId}
                  isBookmarked={Boolean(drill.isBookmarked)}
                  onToggled={() => {
                    void invalidate(queryClient, studentId);
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    setViewingAssignedDrill({
                      id: drillId,
                      title: drill.title ?? "Untitled Drill",
                    })
                  }
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View assigned students"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <Link
                  href={appendReturnTo(
                    `${drillDetailBasePath}/create?${new URLSearchParams({
                      drillId,
                      ...createQueryParams,
                    }).toString()}`,
                    returnTo,
                  )}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit drill"
                >
                  <Edit className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(drillId, drill.title)}
                  disabled={deletingId === drillId}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Delete drill"
                >
                  {deletingId === drillId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
                <Link
                  href={appendReturnTo(
                    `${drillDetailBasePath}/${drillId}`,
                    returnTo,
                  )}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View drill"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        );
      })}

      {enableMove && selectedCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-3xl flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-amber-900">
            {selectedCount} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white/70 rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={openMoveDialog}
              disabled={availableWeeks.length === 0}
              className="px-3 py-1.5 text-sm font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                availableWeeks.length === 0
                  ? "Add another week before moving drills"
                  : "Move selected drills to another week"
              }
            >
              Move to week
            </button>
          </div>
        </div>
      )}

      {enableMove && showMoveDialog && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !moveDrills.isPending) {
              setShowMoveDialog(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Move to week
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Move {selectedCount} drill{selectedCount === 1 ? "" : "s"}{" "}
                  from Week {currentWeekNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMoveDialog(false)}
                disabled={moveDrills.isPending}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {availableWeeks.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No other weeks available. Add a week first, then try again.
                </p>
              ) : (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">
                    Target week ({availableWeeks.length} available)
                  </span>
                  <div
                    role="listbox"
                    aria-label="Target week"
                    className={`${WEEK_PICKER_MAX_HEIGHT_CLASS} overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100`}
                  >
                    {availableWeeks.map((week) => {
                      const isActive = targetWeekNumber === week;
                      return (
                        <button
                          key={week}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          disabled={moveDrills.isPending}
                          onClick={() => setTargetWeekNumber(week)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors disabled:opacity-50 ${
                            isActive
                              ? "bg-amber-50 text-amber-950 font-semibold"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Week {week}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowMoveDialog(false)}
                disabled={moveDrills.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleMoveConfirm()}
                disabled={
                  moveDrills.isPending ||
                  typeof targetWeekNumber !== "number" ||
                  availableWeeks.length === 0
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {moveDrills.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Move drills
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingAssignedDrill && (
        <AssignedStudentsModal
          drillId={viewingAssignedDrill.id}
          drillTitle={viewingAssignedDrill.title}
          onClose={() => setViewingAssignedDrill(null)}
        />
      )}
    </div>
  );
}
