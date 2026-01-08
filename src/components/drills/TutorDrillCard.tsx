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
  };
  onDelete?: (drillId: string) => void;
  isDeleting?: boolean;
  className?: string;
}

function TutorDrillCardComponent({
  drill,
  onDelete,
  isDeleting = false,
  className = "",
}: TutorDrillCardProps) {
  const drillId = drill._id || drill.id || "";
  
  // Memoize computed values
  const assignedCount = useMemo(
    () =>
      Array.isArray(drill.assigned_to)
    ? drill.assigned_to.length
    : drill.assigned_to
    ? 1
        : 0,
    [drill.assigned_to]
  );

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
        return "bg-gray-100 text-gray-700";
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
            <span className="text-2xl">{getDrillIcon(drill.type)}</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
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
                <span className="text-xs text-gray-500 capitalize">
                  {drill.type}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>
                {assignedCount} student{assignedCount !== 1 ? "s" : ""}
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
                drill.is_active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {drill.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Link href={`/tutor/drills/${drillId}/edit`}>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <Edit className="w-5 h-5 text-gray-600" />
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
          <Link href={`/tutor/drills/${drillId}`}>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

// Memoize the component to prevent unnecessary re-renders in lists
export const TutorDrillCard = memo(TutorDrillCardComponent);

