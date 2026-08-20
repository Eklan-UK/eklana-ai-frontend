import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseDrillCompletionDateInput } from "@/lib/drill-completion-date";
import {
  assignmentStatusBadgeClass,
  assignmentStatusLabel,
  getAssignmentStatusDisplay,
  isAssignmentOverdue,
  normalizeAssignmentStatus,
  partitionAssignmentsByStatus,
  resolveAssignmentStatus,
  summarizeAssignmentCounts,
} from "./assignment-status";

describe("normalizeAssignmentStatus", () => {
  it("maps in_progress to in-progress", () => {
    assert.equal(normalizeAssignmentStatus("in_progress"), "in-progress");
    assert.equal(normalizeAssignmentStatus("IN_PROGRESS"), "in-progress");
    assert.equal(normalizeAssignmentStatus("in-progress"), "in-progress");
  });

  it("keeps canonical statuses", () => {
    assert.equal(normalizeAssignmentStatus("pending"), "pending");
    assert.equal(normalizeAssignmentStatus("completed"), "completed");
    assert.equal(normalizeAssignmentStatus("overdue"), "overdue");
    assert.equal(normalizeAssignmentStatus("skipped"), "skipped");
  });

  it("falls back to pending for empty or unknown values", () => {
    assert.equal(normalizeAssignmentStatus(undefined), "pending");
    assert.equal(normalizeAssignmentStatus(null), "pending");
    assert.equal(normalizeAssignmentStatus(""), "pending");
    assert.equal(normalizeAssignmentStatus("unknown"), "pending");
  });
});

describe("resolveAssignmentStatus / overdue", () => {
  let nowSpy: ReturnType<typeof mock.method> | undefined;

  beforeEach(() => {
    nowSpy = undefined;
  });

  afterEach(() => {
    nowSpy?.mock.restore();
  });

  it("does not mark completed or skipped as overdue", () => {
    const due = parseDrillCompletionDateInput("2026-07-20");
    nowSpy = mock.method(Date, "now", () =>
      new Date(2026, 6, 22, 0, 0, 0).getTime(),
    );
    assert.equal(
      resolveAssignmentStatus({ status: "completed", dueDate: due }),
      "completed",
    );
    assert.equal(
      resolveAssignmentStatus({ status: "skipped", dueDate: due }),
      "skipped",
    );
    assert.equal(
      isAssignmentOverdue({ status: "completed", dueDate: due }),
      false,
    );
  });

  it("uses isDrillCompletionOverdue for pending and in-progress", () => {
    const due = parseDrillCompletionDateInput("2026-07-20");
    nowSpy = mock.method(Date, "now", () =>
      new Date(2026, 6, 21, 0, 0, 1).getTime(),
    );
    assert.equal(
      resolveAssignmentStatus({ status: "pending", dueDate: due }),
      "overdue",
    );
    assert.equal(
      resolveAssignmentStatus({ status: "in_progress", dueDate: due }),
      "overdue",
    );
    assert.equal(
      isAssignmentOverdue({ status: "in-progress", dueDate: due }),
      true,
    );
  });

  it("keeps in-progress when the due day has not ended", () => {
    const due = parseDrillCompletionDateInput("2026-07-20");
    nowSpy = mock.method(Date, "now", () =>
      new Date(2026, 6, 20, 9, 0, 0).getTime(),
    );
    assert.equal(
      resolveAssignmentStatus({ status: "in_progress", dueDate: due }),
      "in-progress",
    );
  });

  it("treats stored overdue as overdue even without a due date", () => {
    assert.equal(resolveAssignmentStatus({ status: "overdue" }), "overdue");
    assert.equal(isAssignmentOverdue({ status: "overdue" }), true);
  });
});

describe("labels and badge classes", () => {
  it("returns Title Case labels", () => {
    assert.equal(assignmentStatusLabel({ status: "pending" }), "Pending");
    assert.equal(
      assignmentStatusLabel({ status: "in_progress" }),
      "In Progress",
    );
    assert.equal(assignmentStatusLabel({ status: "completed" }), "Completed");
    assert.equal(assignmentStatusLabel({ status: "overdue" }), "Overdue");
    assert.equal(assignmentStatusLabel({ status: "skipped" }), "Skipped");
  });

  it("returns surface-specific badge classes", () => {
    assert.equal(
      assignmentStatusBadgeClass("weekList", { status: "in-progress" }),
      "bg-blue-50 text-blue-700 border-blue-200",
    );
    assert.equal(
      assignmentStatusBadgeClass("drillDashboard", { status: "in-progress" }),
      "bg-yellow-100 text-yellow-700",
    );
    assert.equal(
      assignmentStatusBadgeClass("assignedStudents", { status: "in_progress" }),
      "bg-blue-100 text-blue-700",
    );
    assert.equal(
      assignmentStatusBadgeClass("assignedStudents", { status: "completed" }),
      "bg-emerald-100 text-emerald-700",
    );
  });

  it("bundles status, label, and class for a surface", () => {
    assert.deepEqual(
      getAssignmentStatusDisplay("weekList", { status: "completed" }),
      {
        status: "completed",
        label: "Completed",
        className: "bg-green-50 text-green-700 border-green-200",
      },
    );
  });
});

describe("summarizeAssignmentCounts / partitionAssignmentsByStatus", () => {
  let nowSpy: ReturnType<typeof mock.method> | undefined;

  beforeEach(() => {
    nowSpy = undefined;
  });

  afterEach(() => {
    nowSpy?.mock.restore();
  });

  it("counts completed and in-progress separately", () => {
    const counts = summarizeAssignmentCounts([
      { status: "completed" },
      { status: "completed" },
      { status: "in_progress" },
      { status: "pending" },
    ]);
    assert.deepEqual(counts, {
      assigned: 4,
      completed: 2,
      inProgress: 1,
      pending: 1,
      overdue: 0,
      skipped: 0,
    });
  });

  it("treats past-due in-progress as overdue for counts and lists", () => {
    const due = parseDrillCompletionDateInput("2026-07-20");
    nowSpy = mock.method(Date, "now", () =>
      new Date(2026, 6, 22, 0, 0, 0).getTime(),
    );
    const assignments = [
      { status: "completed", dueDate: due },
      { status: "in-progress", dueDate: due },
      { status: "pending", dueDate: due },
    ];
    assert.deepEqual(summarizeAssignmentCounts(assignments), {
      assigned: 3,
      completed: 1,
      inProgress: 0,
      pending: 0,
      overdue: 2,
      skipped: 0,
    });
    const parts = partitionAssignmentsByStatus(assignments);
    assert.equal(parts.completed.length, 1);
    assert.equal(parts.inProgress.length, 0);
    assert.equal(parts.remaining.length, 2);
  });

  it("keeps active in-progress out of remaining", () => {
    const due = parseDrillCompletionDateInput("2026-07-20");
    nowSpy = mock.method(Date, "now", () =>
      new Date(2026, 6, 20, 9, 0, 0).getTime(),
    );
    const parts = partitionAssignmentsByStatus([
      { status: "in_progress", dueDate: due },
      { status: "pending", dueDate: due },
    ]);
    assert.equal(parts.inProgress.length, 1);
    assert.equal(parts.remaining.length, 1);
  });
});
