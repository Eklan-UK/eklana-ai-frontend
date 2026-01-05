/**
 * Reusable Drill Card Component
 * DRY: Eliminates duplicate drill card rendering logic
 */
"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Calendar, Target, CheckCircle } from "lucide-react";
import { getDrillIcon, getDrillTypeInfo, formatDate, getDrillStatus } from "@/utils/drill";
import { getStatusBadge } from "@/utils/drill-ui";

export interface DrillCardProps {
  drill: any;
  assignmentId?: string;
  assignedBy?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  dueDate?: string;
  completedAt?: string;
  latestAttempt?: {
    score?: number;
    timeSpent?: number;
    completedAt?: string;
  };
  status?: string;
  variant?: "default" | "compact" | "detailed";
  showStartButton?: boolean;
  onStartClick?: (drillId: string, assignmentId?: string) => void;
  className?: string;
}

export function DrillCard({
  drill,
  assignmentId,
  assignedBy,
  dueDate,
  completedAt,
  latestAttempt,
  status,
  variant = "default",
  showStartButton = true,
  onStartClick,
  className = "",
}: DrillCardProps) {
  const typeInfo = getDrillTypeInfo(drill.type);
  const drillStatus = getDrillStatus({ drill, dueDate, completedAt, assignmentStatus: status });
  
  // Calculate due date
  const calculatedDueDate = dueDate
    ? new Date(dueDate)
    : (() => {
        const endDate = new Date(drill.date);
        endDate.setDate(endDate.getDate() + (drill.duration_days || 1) - 1);
        return endDate;
      })();

  const isOverdue = drillStatus === "missed";
  const drillUrl = assignmentId
    ? `/account/drills/${drill._id}?assignmentId=${assignmentId}`
    : `/account/drills/${drill._id}`;

  const handleClick = (e: React.MouseEvent) => {
    if (onStartClick) {
      e.preventDefault();
      onStartClick(drill._id, assignmentId);
    }
  };

  if (variant === "compact") {
    return (
      <Link href={drillUrl} onClick={handleClick}>
        <Card
          className={`${typeInfo.borderColor} hover:shadow-md transition-shadow cursor-pointer ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{typeInfo.icon}</span>
              <span className="font-medium text-gray-900">{drill.title}</span>
            </div>
            {showStartButton && (
              <Button variant="primary" size="sm">
                Start
              </Button>
            )}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Card
      key={assignmentId || drill._id}
      className={`p-4 hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex items-start gap-3 flex-1 cursor-pointer"
          onClick={() => onStartClick?.(drill._id, assignmentId)}
        >
          <span className="text-2xl">{getDrillIcon(drill.type)}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1 truncate">
              {drill.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 capitalize">
                {drill.type}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Target className="w-3 h-3" />
                <span className="capitalize">{drill.difficulty}</span>
              </div>
            </div>
          </div>
        </div>
        {getStatusBadge({ drill, dueDate, completedAt, assignmentStatus: status })}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>Due: {formatDate(calculatedDueDate.toISOString())}</span>
        </div>
        {latestAttempt?.score !== undefined && (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Score: {latestAttempt.score}%</span>
          </div>
        )}
      </div>

      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
          <p className="text-xs text-red-700">This drill is overdue</p>
        </div>
      )}

      {assignedBy && variant === "detailed" && (
        <p className="text-xs text-gray-400 mb-3">
          Assigned by: {assignedBy.firstName} {assignedBy.lastName}
        </p>
      )}

      {showStartButton && (
        <div className="flex justify-end mt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onStartClick?.(drill._id, assignmentId);
            }}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
          >
            Start
          </Button>
        </div>
      )}
    </Card>
  );
}


