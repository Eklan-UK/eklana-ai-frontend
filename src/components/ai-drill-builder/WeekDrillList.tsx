"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2, Loader2, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import { getDrillIcon } from "@/utils/drill";
import { appendReturnTo } from "@/lib/drill-list-filters";
import { invalidateStudentWeeks } from "@/hooks/useStudentWeeks";
import { AssignedStudentsModal } from "@/components/drills/AssignedStudentsModal";
import type { WeekDrillItem } from "@/lib/ai-drill-builder/week-utils";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-50 text-green-700 border-green-200",
  "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-gray-50 text-gray-600 border-gray-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
};

// Matches the "Saved" badge styling used in TutorDrillCard for drills that
// still need a tutor/admin to select users and update/assign them.
const SAVED_BADGE_CLASS = "bg-amber-50 text-amber-700 border-amber-200";

interface WeekDrillListProps {
  drills: WeekDrillItem[];
  drillDetailBasePath: string;
  returnTo: string;
  /** Student whose weekly drill breakdown should be refreshed after a delete. */
  studentId: string;
}

export function WeekDrillList({
  drills,
  drillDetailBasePath,
  returnTo,
  studentId,
}: WeekDrillListProps) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingAssignedDrill, setViewingAssignedDrill] = useState<{
    id: string;
    title: string;
  } | null>(null);

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
      await invalidateStudentWeeks(queryClient, studentId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete drill: " + message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {drills.map((drill) => {
        const drillType = drill.drillType ?? drill.type ?? "drill";
        const status = drill.status ?? "pending";
        const statusClass = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
        // Saved drills (is_active: false) still need a tutor/admin to select
        // users and update/assign them, so surface that alongside the status.
        const isSaved = drill.isActive === false;
        const drillId = drill.drillId ? String(drill.drillId) : null;
        const key = drill.assignmentId ?? drillId ?? drill.title ?? drillType;

        const infoBlock = (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl shrink-0" aria-hidden>
              {getDrillIcon(drillType)}
            </span>
            <div className="min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {drill.title ?? "Untitled Drill"}
              </h4>
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
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${statusClass}`}
                >
                  {status.replace("-", " ")}
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
            className="flex items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-colors"
          >
            {drillId ? (
              <Link
                href={appendReturnTo(`${drillDetailBasePath}/${drillId}`, returnTo)}
                className="min-w-0 flex-1"
              >
                {infoBlock}
              </Link>
            ) : (
              infoBlock
            )}

            {drillId && (
              <div className="flex items-center gap-1 shrink-0">
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
                    `${drillDetailBasePath}/create?drillId=${drillId}`,
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
                  href={appendReturnTo(`${drillDetailBasePath}/${drillId}`, returnTo)}
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
