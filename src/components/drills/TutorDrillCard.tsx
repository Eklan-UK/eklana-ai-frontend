/**
 * Reusable Tutor Drill Card Component
 * DRY: Eliminates duplicate tutor drill card rendering logic
 * Optimized: Memoized to prevent unnecessary re-renders
 */
"use client";

import React, { memo, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Users, Clock, Edit, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { getDrillIcon } from "@/utils/drill";
import { Checkbox } from "@/components/ui/Checkbox";

import {
  appendReturnTo,
} from "@/lib/drill-list-filters";

export interface TutorDrillCardProps {
  drill: {
    _id?: string;
    id?: string;
    title: string;
    type: string;
    difficulty: string;
    date: string;
    duration_days?: number;
    assigned_to?: string[] | string;
    is_active?: boolean;
    totalAssignments?: number;
  };
  onDelete?: (drillId: string) => void;
  isDeleting?: boolean;
  className?: string;
  returnToParam?: string;
  selectable?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function TutorDrillCardComponent({
  drill,
  onDelete,
  isDeleting = false,
  className = "",
  returnToParam,
  selectable = false,
  checked = false,
  onCheckedChange,
}: TutorDrillCardProps) {
  const drillId = drill._id || drill.id || "";

  const editHref = returnToParam
    ? appendReturnTo(`/tutor/drills/create?drillId=${drillId}`, returnToParam)
    : `/tutor/drills/create?drillId=${drillId}`;
  const viewHref = returnToParam
    ? appendReturnTo(`/tutor/drills/${drillId}`, returnToParam)
    : `/tutor/drills/${drillId}`;
  
  // Memoize computed values
  const assignedCount = useMemo(() => {
    if (drill.totalAssignments !== undefined) {
      return drill.totalAssignments;
    }
    return Array.isArray(drill.assigned_to)
      ? drill.assigned_to.length
      : drill.assigned_to
        ? 1
        : 0;
  }, [drill.assigned_to, drill.totalAssignments]);

  const isAssigned = assignedCount > 0;

  // drill.date is now the completion/due date
  const completionDate = useMemo(() => new Date(drill.date), [drill.date]);

  const getDifficultyColor = useCallback((difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-700";
      case "intermediate":
        return "bg-yellow-100 text-yellow-700";
      case "advanced":
        return "bg-red-100 text-red-700";
      default:
        return "bg-muted text-foreground";
    }
  }, []);
  
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(drillId);
    }
  }, [onDelete, drillId]);

  return (
    <Card
      key={drillId}
      className={`hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {selectable && (
              <Checkbox
                checked={checked}
                onChange={(e) => onCheckedChange?.(e.target.checked)}
                aria-label={`Select ${drill.title}`}
                className="rounded border-gray-300 shrink-0"
              />
            )}
            <span className="text-2xl">{getDrillIcon(drill.type)}</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                {drill.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(
                    drill.difficulty
                  )}`}
                >
                  {drill.difficulty}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {drill.type}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>
                {isAssigned
                  ? `${assignedCount} student${assignedCount !== 1 ? "s" : ""}`
                  : "Not assigned"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                Due {completionDate.toLocaleDateString()}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                isAssigned
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {isAssigned ? "Assigned" : "Saved"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Link href={editHref}>
            <button className="p-2 hover:bg-muted rounded-lg transition">
              <Edit className="w-5 h-5 text-muted-foreground" />
            </button>
          </Link>
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5 text-red-600" />
              )}
            </button>
          )}
          <Link href={viewHref}>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

// Memoize the component to prevent unnecessary re-renders in lists
export const TutorDrillCard = memo(TutorDrillCardComponent);

