"use client";

import Link from "next/link";
import type { WeekDrillItem } from "@/lib/ai-drill-builder/week-utils";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-50 text-green-700 border-green-200",
  "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-gray-50 text-gray-600 border-gray-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
};

interface WeekDrillListProps {
  drills: WeekDrillItem[];
  drillDetailBasePath: string;
  returnTo: string;
}

export function WeekDrillList({
  drills,
  drillDetailBasePath,
  returnTo,
}: WeekDrillListProps) {
  if (drills.length === 0) {
    return (
      <div className="bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          No drills assigned for this week yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drills.map((drill) => {
        const drillType = drill.drillType ?? drill.type ?? "drill";
        const status = drill.status ?? "pending";
        const statusClass =
          STATUS_STYLES[status] ?? STATUS_STYLES.pending;
        const drillId = drill.drillId;

        const content = (
          <div className="flex items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
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
              </div>
            </div>
          </div>
        );

        if (drillId) {
          return (
            <Link
              key={drill.assignmentId ?? String(drillId)}
              href={`${drillDetailBasePath}/${drillId}?returnTo=${encodeURIComponent(returnTo)}`}
            >
              {content}
            </Link>
          );
        }

        return (
          <div key={drill.assignmentId ?? drill.title}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
