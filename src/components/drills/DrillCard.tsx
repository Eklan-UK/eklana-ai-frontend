/**
 * Reusable Drill Card Component
 * DRY: Eliminates duplicate drill card rendering logic
 * Optimized: Memoized to prevent unnecessary re-renders
 */
"use client";

import React, { memo, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  Target,
  CheckCircle,
  Clock3,
  AlertCircle,
  Lock,
} from "lucide-react";
import {
  getDrillIcon,
  getDrillTypeInfo,
  formatDate,
  getDrillStatus,
  getDrillTypeLabel,
} from "@/utils/drill";
import { getStatusBadge } from "@/utils/drill-ui";
import { usePrefetchDrill } from "@/hooks/useDrills";
import { ProLockHoverWrap } from "@/components/subscription/ProLockHoverWrap";
import { ProLockedCtaSwap } from "@/components/subscription/ProLockedCtaSwap";

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
    reviewStatus?: "pending" | "reviewed";
    correctCount?: number;
    totalCount?: number;
  };
  status?: string;
  variant?: "default" | "compact" | "detailed";
  showStartButton?: boolean;
  onStartClick?: (drillId: string, assignmentId?: string) => void;
  className?: string;
  locked?: boolean;
}

// Review Status Badge Component
function ReviewBadge({
  reviewStatus,
  correctCount,
  totalCount,
}: {
  reviewStatus?: "pending" | "reviewed";
  correctCount?: number;
  totalCount?: number;
}) {
  if (!reviewStatus) return null;

  if (reviewStatus === "pending") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 text-xs font-medium">
        <Clock3 className="w-3 h-3" />
        <span>Pending Review</span>
      </div>
    );
  }

  // Reviewed status
  const allCorrect = correctCount === totalCount && totalCount && totalCount > 0;
  const hasIncorrect = correctCount !== undefined && totalCount !== undefined && correctCount < totalCount;

  if (allCorrect) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
        <CheckCircle className="w-3 h-3" />
        <span>All Correct</span>
      </div>
    );
  }

  if (hasIncorrect) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-200 text-xs font-medium">
        <AlertCircle className="w-3 h-3" />
        <span>
          {correctCount}/{totalCount} Correct
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
      <CheckCircle className="w-3 h-3" />
      <span>Reviewed</span>
    </div>
  );
}

function DrillCardComponent({
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
  locked = false,
}: DrillCardProps) {
  // Memoize computed values to prevent recalculation on every render
  const typeInfo = useMemo(() => getDrillTypeInfo(drill.type), [drill.type]);

  const topicTitle =
    typeof drill.topicTitle === "string" ? drill.topicTitle : null;
  
  const drillStatus = useMemo(
    () =>
      getDrillStatus({ drill, dueDate, completedAt, assignmentStatus: status }),
    [drill, dueDate, completedAt, status]
  );

  // Calculate due date (drill.date is now the completion/due date)
  const calculatedDueDate = useMemo(
    () => (dueDate ? new Date(dueDate) : new Date(drill.date)),
    [dueDate, drill.date]
  );

  const isOverdue = drillStatus === "missed";
  const isUpcoming = drillStatus === "upcoming";
  const isCompleted = drillStatus === "completed";

  // Check if this drill type has reviews (sentence, grammar, or summary)
  const hasReviews = drill.type === "sentence" || drill.type === "grammar" || drill.type === "summary";
  const showReviewBadge =
    isCompleted && hasReviews && latestAttempt?.reviewStatus;

  // Determine drill URL based on status
  const drillUrl = useMemo(
    () =>
    isCompleted && assignmentId
      ? `/account/drills/${drill._id}/completed?assignmentId=${assignmentId}`
      : assignmentId
      ? `/account/drills/${drill._id}?assignmentId=${assignmentId}`
        : `/account/drills/${drill._id}`,
    [isCompleted, assignmentId, drill._id]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
    if (onStartClick && !isUpcoming && !isCompleted) {
      e.preventDefault();
      onStartClick(drill._id, assignmentId);
    }
    },
    [onStartClick, isUpcoming, isCompleted, drill._id, assignmentId]
  );

  // Prefetch drill data on hover for faster navigation
  const prefetchDrill = usePrefetchDrill();
  const handleMouseEnter = useCallback(() => {
    if (drill._id) {
      prefetchDrill(drill._id);
    }
  }, [drill._id, prefetchDrill]);

  if (variant === "compact") {
    const cardBody = (
      <Card
        className={`${typeInfo.borderColor} ${
          locked
            ? "cursor-default"
            : "hover:shadow-md transition-shadow cursor-pointer"
        } ${className}`}
        onMouseEnter={locked ? undefined : handleMouseEnter}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg sm:text-xl flex-shrink-0">{typeInfo.icon}</span>
            <span className="font-medium text-foreground text-sm sm:text-base truncate">{drill.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showReviewBadge && (
              <div className="hidden sm:block">
                <ReviewBadge
                  reviewStatus={latestAttempt?.reviewStatus}
                  correctCount={latestAttempt?.correctCount}
                  totalCount={latestAttempt?.totalCount}
                />
              </div>
            )}
            {showStartButton && (
              locked ? (
                <ProLockHoverWrap className="inline-flex">
                  <ProLockedCtaSwap density="default">
                    <Button
                      variant="primary"
                      size="sm"
                      tabIndex={-1}
                      type="button"
                      className="bg-muted text-muted-foreground cursor-default text-xs sm:text-sm px-2 sm:px-4 flex items-center gap-1 pointer-events-none"
                    >
                      <Lock className="w-3 h-3" />
                      Pro
                    </Button>
                  </ProLockedCtaSwap>
                </ProLockHoverWrap>
              ) : (
                <Button variant="primary" size="sm" disabled={isUpcoming} className="text-xs sm:text-sm px-2 sm:px-4">
                  {isUpcoming
                    ? "View"
                    : isCompleted
                      ? "Review"
                    : "Start"}
                </Button>
              )
            )}
          </div>
        </div>
      </Card>
    );

    if (locked) {
      return cardBody;
    }

    return (
      <Link
        href={drillUrl}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
      >
        {cardBody}
      </Link>
    );
  }

  const detailedCard = (
    <Card
      key={assignmentId || drill._id}
      className={`p-3 sm:p-4 transition-shadow ${className} ${
        locked ? "cursor-default" : "hover:shadow-md"
      }`}
      onMouseEnter={locked ? undefined : handleMouseEnter}
    >
      {/* Header: Icon, Title, Status Badge */}
      <div className="flex items-start gap-2 sm:gap-3 mb-3">
        <span className="text-xl sm:text-2xl flex-shrink-0">{getDrillIcon(drill.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {variant === "detailed" && topicTitle ? (
                <p className="text-sm font-bold text-foreground line-clamp-2 mb-0.5">
                  {topicTitle}
                </p>
              ) : null}
              <h3 className="font-semibold text-foreground text-sm sm:text-base line-clamp-2 sm:truncate">
                {drill.title}
              </h3>
            </div>
            <div className="flex-shrink-0 hidden sm:block">
              {getStatusBadge({
                drill,
                dueDate,
                completedAt,
                assignmentStatus: status,
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-xs text-muted-foreground">
              {getDrillTypeLabel(drill.type)}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="w-3 h-3" />
              <span className="capitalize">{drill.difficulty}</span>
            </div>
          </div>
          {/* Mobile status badge */}
          <div className="sm:hidden mt-2">
            {getStatusBadge({
              drill,
              dueDate,
              completedAt,
              assignmentStatus: status,
            })}
          </div>
        </div>
      </div>

      {/* Due date and score info */}
      <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span className="whitespace-nowrap">Due: {formatDate(calculatedDueDate.toISOString())}</span>
        </div>
        {latestAttempt?.score !== undefined && (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 flex-shrink-0" />
            <span>Score: {latestAttempt.score}%</span>
          </div>
        )}
      </div>

      {/* Review Status Badge for completed drills */}
      {showReviewBadge && (
        <div className="mb-3">
          <ReviewBadge
            reviewStatus={latestAttempt?.reviewStatus}
            correctCount={latestAttempt?.correctCount}
            totalCount={latestAttempt?.totalCount}
          />
        </div>
      )}

      {isOverdue && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-2">
          <p className="text-xs text-red-800 dark:text-red-200">This drill is overdue</p>
        </div>
      )}

      {/* Footer: Assigned by + Action button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {assignedBy && variant === "detailed" && (
            <p className="text-xs text-muted-foreground truncate">
              Assigned by: {assignedBy.firstName} {assignedBy.lastName}
            </p>
          )}
        </div>

        {showStartButton && (
          <div className="flex-shrink-0">
            {locked ? (
              <ProLockHoverWrap className="inline-flex">
                <ProLockedCtaSwap density="default">
                  <Button
                    variant="primary"
                    size="sm"
                    tabIndex={-1}
                    type="button"
                    className="bg-muted text-muted-foreground cursor-default text-xs sm:text-sm px-3 sm:px-4 flex items-center gap-1.5 pointer-events-none"
                  >
                    <Lock className="w-3 h-3" />
                    Pro
                  </Button>
                </ProLockedCtaSwap>
              </ProLockHoverWrap>
            ) : isUpcoming ? (
              <Link href={`/account/drills/${drill._id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={true}
                  className="bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed text-xs sm:text-sm px-3 sm:px-4"
                >
                  View
                </Button>
              </Link>
            ) : (
              <Link href={drillUrl}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartClick && !isCompleted) {
                      e.preventDefault();
                      onStartClick(drill._id, assignmentId);
                    }
                  }}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs sm:text-sm px-3 sm:px-4"
                >
                  {isCompleted ? "View Results" : "Start"}
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  return detailedCard;
}

// Memoize the component to prevent unnecessary re-renders in lists
export const DrillCard = memo(DrillCardComponent);
