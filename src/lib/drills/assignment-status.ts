import { isDrillCompletionOverdue } from "@/lib/drill-completion-date";

export type AssignmentStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "overdue"
  | "skipped";

export type AssignmentStatusBadgeSurface =
  | "weekList"
  | "drillDashboard"
  | "assignedStudents";

export type AssignmentStatusInput = {
  status?: string | null;
  dueDate?: Date | string | null;
};

const CANONICAL_STATUSES = new Set<AssignmentStatus>([
  "pending",
  "in-progress",
  "completed",
  "overdue",
  "skipped",
]);

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  overdue: "Overdue",
  skipped: "Skipped",
};

export const ASSIGNMENT_STATUS_BADGE_CLASSES: Record<
  AssignmentStatusBadgeSurface,
  Record<AssignmentStatus, string>
> = {
  weekList: {
    pending: "bg-gray-50 text-gray-600 border-gray-200",
    "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
    skipped: "bg-gray-50 text-gray-600 border-gray-200",
  },
  drillDashboard: {
    pending: "bg-gray-100 text-gray-700",
    "in-progress": "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    skipped: "bg-gray-100 text-gray-700",
  },
  assignedStudents: {
    pending: "bg-gray-100 text-gray-600",
    "in-progress": "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    overdue: "bg-red-100 text-red-700",
    skipped: "bg-gray-100 text-gray-600",
  },
};

/** Canonicalize stored/API status. Maps `in_progress` → `in-progress`. */
export function normalizeAssignmentStatus(
  status?: string | null,
): AssignmentStatus {
  if (!status) return "pending";
  const normalized = status.trim().toLowerCase().replace(/_/g, "-");
  if (CANONICAL_STATUSES.has(normalized as AssignmentStatus)) {
    return normalized as AssignmentStatus;
  }
  return "pending";
}

/**
 * True when the assignment is overdue: not completed/skipped, and the due date
 * has passed (`isDrillCompletionOverdue`), or status is already `overdue`.
 */
export function isAssignmentOverdue(input: AssignmentStatusInput): boolean {
  const status = normalizeAssignmentStatus(input.status);
  if (status === "completed" || status === "skipped") return false;
  if (status === "overdue") return true;
  return isDrillCompletionOverdue(input.dueDate);
}

/** Display status: overdue wins over pending / in-progress. */
export function resolveAssignmentStatus(
  input: AssignmentStatusInput,
): AssignmentStatus {
  const status = normalizeAssignmentStatus(input.status);
  if (status === "completed" || status === "skipped") return status;
  if (isAssignmentOverdue(input)) return "overdue";
  return status;
}

export function assignmentStatusLabel(input: AssignmentStatusInput): string {
  return ASSIGNMENT_STATUS_LABELS[resolveAssignmentStatus(input)];
}

export function assignmentStatusBadgeClass(
  surface: AssignmentStatusBadgeSurface,
  input: AssignmentStatusInput,
): string {
  return ASSIGNMENT_STATUS_BADGE_CLASSES[surface][
    resolveAssignmentStatus(input)
  ];
}

export function getAssignmentStatusDisplay(
  surface: AssignmentStatusBadgeSurface,
  input: AssignmentStatusInput,
): { status: AssignmentStatus; label: string; className: string } {
  const status = resolveAssignmentStatus(input);
  return {
    status,
    label: ASSIGNMENT_STATUS_LABELS[status],
    className: ASSIGNMENT_STATUS_BADGE_CLASSES[surface][status],
  };
}

export type AssignmentStatusCounts = {
  assigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  skipped: number;
};

/** Headline counts for staff drill dashboards (resolved status, overdue wins). */
export function summarizeAssignmentCounts(
  assignments: AssignmentStatusInput[],
): AssignmentStatusCounts {
  const counts: AssignmentStatusCounts = {
    assigned: assignments.length,
    completed: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0,
    skipped: 0,
  };
  for (const assignment of assignments) {
    switch (resolveAssignmentStatus(assignment)) {
      case "completed":
        counts.completed += 1;
        break;
      case "in-progress":
        counts.inProgress += 1;
        break;
      case "pending":
        counts.pending += 1;
        break;
      case "overdue":
        counts.overdue += 1;
        break;
      case "skipped":
        counts.skipped += 1;
        break;
    }
  }
  return counts;
}

export type PartitionedAssignments<T extends AssignmentStatusInput> = {
  completed: T[];
  inProgress: T[];
  /** Pending, overdue, and skipped — not completed and not actively in progress. */
  remaining: T[];
};

/** Split assignments for staff lists: Completed / In Progress / remaining. */
export function partitionAssignmentsByStatus<T extends AssignmentStatusInput>(
  assignments: T[],
): PartitionedAssignments<T> {
  const completed: T[] = [];
  const inProgress: T[] = [];
  const remaining: T[] = [];
  for (const assignment of assignments) {
    const status = resolveAssignmentStatus(assignment);
    if (status === "completed") completed.push(assignment);
    else if (status === "in-progress") inProgress.push(assignment);
    else remaining.push(assignment);
  }
  return { completed, inProgress, remaining };
}
