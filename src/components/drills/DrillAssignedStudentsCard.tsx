"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { drillCompletionDateEnd } from "@/lib/drill-completion-date";
import {
  getAssignmentStatusDisplay,
  partitionAssignmentsByStatus,
  summarizeAssignmentCounts,
  type AssignmentStatusInput,
} from "@/lib/drills/assignment-status";

export type DrillAssignedStudentRow = AssignmentStatusInput & {
  _id?: string;
  score?: number | null;
  completedAt?: string | Date | null;
  userId?: any;
  user?: any;
  learnerId?: any;
};

function resolveAssignmentUser(assignment: DrillAssignedStudentRow) {
  const user =
    assignment.userId || assignment.user || assignment.learnerId;
  const userName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
    : "Unknown User";
  const userEmail = user?.email || "N/A";
  const userId =
    user?._id || assignment.learnerId?._id || assignment.learnerId;
  return { userName, userEmail, userId };
}

interface DrillAssignedStudentsCardProps {
  assignments: DrillAssignedStudentRow[];
  /** Build learner profile / drills href from user id. */
  getLearnerHref: (userId: string) => string;
  /** When set, show Manage Assignments / Assign Students actions. */
  manageAssignmentsHref?: string;
}

/**
 * Shared staff dashboard card: Assigned / Completed / In Progress summary
 * plus Completed, In Progress, and remaining pending/overdue student lists.
 */
export function DrillAssignedStudentsCard({
  assignments,
  getLearnerHref,
  manageAssignmentsHref,
}: DrillAssignedStudentsCardProps) {
  if (assignments.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No students assigned to this drill yet
          </p>
          {manageAssignmentsHref && (
            <Link href={manageAssignmentsHref}>
              <Button variant="primary" size="sm" className="mt-4">
                Assign Students
              </Button>
            </Link>
          )}
        </div>
      </Card>
    );
  }

  const counts = summarizeAssignmentCounts(assignments);
  const { completed, inProgress, remaining } =
    partitionAssignmentsByStatus(assignments);

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Assigned Students
          </h2>
          <p className="text-sm text-gray-500">
            {counts.completed} completed • {counts.inProgress} in progress •{" "}
            {counts.assigned} total
          </p>
        </div>
        {manageAssignmentsHref && (
          <Link href={manageAssignmentsHref}>
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Manage Assignments
            </Button>
          </Link>
        )}
      </div>

      {completed.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Completed ({counts.completed})
            </h3>
          </div>
          <div className="space-y-2">
            {completed.map((assignment) => {
              const { userName, userEmail, userId } =
                resolveAssignmentUser(assignment);
              const href = userId ? getLearnerHref(String(userId)) : undefined;

              const row = (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{userName}</p>
                    <p className="text-sm text-gray-500">{userEmail}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    {assignment.score !== undefined &&
                      assignment.score !== null && (
                        <span className="text-sm font-semibold text-green-700">
                          {assignment.score}%
                        </span>
                      )}
                    {assignment.completedAt && (
                      <span className="text-xs text-gray-500">
                        {new Date(assignment.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );

              return href ? (
                <Link key={assignment._id} href={href} className="block">
                  {row}
                </Link>
              ) : (
                <div key={assignment._id}>{row}</div>
              );
            })}
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              In Progress ({counts.inProgress})
            </h3>
          </div>
          <div className="space-y-2">
            {inProgress.map((assignment) => {
              const { userName, userEmail, userId } =
                resolveAssignmentUser(assignment);
              const href = userId ? getLearnerHref(String(userId)) : undefined;
              const { label, className } = getAssignmentStatusDisplay(
                "drillDashboard",
                assignment,
              );

              const row = (
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{userName}</p>
                    <p className="text-sm text-gray-500">{userEmail}</p>
                    {assignment.dueDate && (
                      <p className="text-xs mt-1 text-gray-500">
                        Due:{" "}
                        {drillCompletionDateEnd(
                          assignment.dueDate,
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}
                    >
                      {label}
                    </span>
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              );

              return href ? (
                <Link key={assignment._id} href={href} className="block">
                  {row}
                </Link>
              ) : (
                <div key={assignment._id}>{row}</div>
              );
            })}
          </div>
        </div>
      )}

      {remaining.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Pending / Overdue ({remaining.length})
            </h3>
          </div>
          <div className="space-y-2">
            {remaining.map((assignment) => {
              const { userName, userEmail, userId } =
                resolveAssignmentUser(assignment);
              const href = userId ? getLearnerHref(String(userId)) : undefined;
              const { status, label, className } = getAssignmentStatusDisplay(
                "drillDashboard",
                assignment,
              );
              const isOverdue = status === "overdue";

              const row = (
                <div
                  className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors ${
                    isOverdue
                      ? "bg-red-50 border border-red-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{userName}</p>
                    <p className="text-sm text-gray-500">{userEmail}</p>
                    {assignment.dueDate && (
                      <p
                        className={`text-xs mt-1 ${
                          isOverdue
                            ? "text-red-600 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        Due:{" "}
                        {drillCompletionDateEnd(
                          assignment.dueDate,
                        ).toLocaleDateString()}
                        {isOverdue && " (Overdue)"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}
                    >
                      {label}
                    </span>
                    {isOverdue ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              );

              return href ? (
                <Link key={assignment._id} href={href} className="block">
                  {row}
                </Link>
              ) : (
                <div key={assignment._id}>{row}</div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
