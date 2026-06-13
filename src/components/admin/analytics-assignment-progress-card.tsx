"use client";

interface AnalyticsAssignmentProgressCardProps {
  totalAssigned: number;
  totalCompleted: number;
  completionRatePct: number;
  variant?: "learner" | "platform";
}

export function AnalyticsAssignmentProgressCard({
  totalAssigned,
  totalCompleted,
  completionRatePct,
  variant = "learner",
}: AnalyticsAssignmentProgressCardProps) {
  if (variant === "platform") {
    return (
      <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
        <p className="text-xs font-medium text-gray-500 uppercase mb-3">Assignment Progress</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalAssigned}</p>
            <p className="text-xs text-gray-500 mt-1">Total Assigned</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600">{totalCompleted}</p>
            <p className="text-xs text-gray-500 mt-1">Total Completed</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">{completionRatePct}% completion rate</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-500 bg-indigo-500/5 p-5 shadow-sm">
      <p className="text-sm font-semibold text-muted-foreground mb-3">Assignment Progress</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-nunito text-3xl font-bold tabular-nums text-foreground">
            {totalAssigned}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total Assigned</p>
        </div>
        <div>
          <p className="font-nunito text-3xl font-bold tabular-nums text-indigo-600">
            {totalCompleted}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total Completed</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{completionRatePct}% completion rate</p>
    </div>
  );
}
