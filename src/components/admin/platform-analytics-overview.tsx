"use client";

import { useMemo, useState } from "react";
import {
  Users,
  BookOpen,
  Target,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  BarChart3,
} from "lucide-react";
import { usePlatformAnalyticsOverview } from "@/hooks/useAdmin";
import { useOverallPronunciationAnalytics } from "@/hooks/usePronunciations";
import { PlatformPronunciationAnalytics } from "@/components/admin/platform-pronunciation-analytics";
import { PlatformFillBlankAnalytics } from "@/components/admin/platform-fill-blank-analytics";
import { PlatformKeyPhrasesAnalytics } from "@/components/admin/platform-key-phrases-analytics";

const DAY_OPTIONS = [7, 30, 90] as const;

export function PlatformAnalyticsOverview() {
  const [days, setDays] = useState<number>(30);

  const { data: overview, isLoading: overviewLoading } = usePlatformAnalyticsOverview();
  const { data: pronunciationData, isLoading: pronunciationLoading } =
    useOverallPronunciationAnalytics(days);

  const platformOverallProgress = useMemo(() => {
    const drillCompletion = overview?.drills?.completionRatePct ?? 0;
    const pronunciationPassRate = pronunciationData?.stats?.passRate ?? 0;

    if (drillCompletion > 0 && pronunciationPassRate > 0) {
      return Math.round(drillCompletion * 0.5 + pronunciationPassRate * 0.5);
    }
    if (drillCompletion > 0) return Math.round(drillCompletion);
    if (pronunciationPassRate > 0) return Math.round(pronunciationPassRate);
    return 0;
  }, [overview, pronunciationData]);

  const loading = overviewLoading || pronunciationLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Platform Overview
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Combined drills and pronunciation performance across all learners
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase">Period</span>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {DAY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  days === option
                    ? "bg-[#418b43] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Active Learners"
              value={overview?.learners?.totalActive ?? 0}
              icon={<Users className="w-5 h-5 text-emerald-600" />}
              color="border-emerald-200 bg-emerald-50/50"
            />
            <StatCard
              title="Learners with Drills"
              value={overview?.learners?.totalWithAssignments ?? 0}
              icon={<BookOpen className="w-5 h-5 text-blue-600" />}
              color="border-blue-200 bg-blue-50/50"
            />
            <StatCard
              title="Drill Completion"
              value={`${overview?.drills?.completionRatePct ?? 0}%`}
              icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
              color="border-green-200 bg-green-50/50"
            />
            <StatCard
              title="Overall Progress"
              value={`${platformOverallProgress}%`}
              icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
              color="border-purple-200 bg-purple-50/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Drill Assignments"
              value={overview?.drills?.totalAssignments ?? 0}
              icon={<Target className="w-5 h-5 text-amber-600" />}
              color="border-amber-200 bg-amber-50/50"
              small
            />
            <StatCard
              title="Avg Drill Score"
              value={`${overview?.drills?.averageScore ?? 0}%`}
              icon={<BarChart3 className="w-5 h-5 text-indigo-600" />}
              color="border-indigo-200 bg-indigo-50/50"
              small
            />
            <StatCard
              title="Avg Pronunciation Score"
              value={`${pronunciationData?.stats?.averageScore ?? 0}%`}
              icon={<TrendingUp className="w-5 h-5 text-cyan-600" />}
              color="border-cyan-200 bg-cyan-50/50"
              small
            />
            <StatCard
              title="Pronunciation Pass Rate"
              value={`${pronunciationData?.stats?.passRate ?? 0}%`}
              icon={<CheckCircle2 className="w-5 h-5 text-teal-600" />}
              color="border-teal-200 bg-teal-50/50"
              small
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatusPill label="Completed" value={overview?.drills?.completed ?? 0} color="text-green-700 bg-green-100" />
            <StatusPill label="In Progress" value={overview?.drills?.inProgress ?? 0} color="text-blue-700 bg-blue-100" />
            <StatusPill label="Pending" value={overview?.drills?.pending ?? 0} color="text-amber-700 bg-amber-100" />
            <StatusPill label="Overdue" value={overview?.drills?.overdue ?? 0} color="text-red-700 bg-red-100" />
          </div>
        </>
      )}

      <PlatformPronunciationAnalytics days={days} />
      <PlatformFillBlankAnalytics days={days} />
      <PlatformKeyPhrasesAnalytics days={days} />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  small,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  small?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase">{title}</p>
        {icon}
      </div>
      <p className={`font-bold text-gray-900 ${small ? "text-xl" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${color}`}>
      <span className="text-xs font-semibold uppercase">{label}</span>
      <span className="text-lg font-bold flex items-center gap-1">
        {value}
        {label === "Overdue" && value > 0 ? (
          <AlertCircle className="w-4 h-4" />
        ) : label === "Pending" ? (
          <Clock className="w-4 h-4" />
        ) : null}
      </span>
    </div>
  );
}
