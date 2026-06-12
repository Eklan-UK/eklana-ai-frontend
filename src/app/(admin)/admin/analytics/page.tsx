"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AnalyticsLearnerFilter } from "@/components/admin/analytics-learner-filter";
import { AdminAnalyticsDashboard } from "@/components/admin/admin-analytics-dashboard";

function AdminAnalyticsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedLearnerIds = useMemo(() => {
    const param = searchParams.get("learners");
    if (!param) return [];
    return param
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }, [searchParams]);

  const setSelectedLearnerIds = useCallback(
    (learnerIds: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (learnerIds.length === 0) {
        params.delete("learners");
      } else {
        params.set("learners", learnerIds.join(","));
      }
      const qs = params.toString();
      router.replace(qs ? `/admin/analytics?${qs}` : "/admin/analytics", { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const param = searchParams.get("learners");
    if (!param) return;
    const cleaned = param
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (cleaned.join(",") !== param) {
      setSelectedLearnerIds(cleaned);
    }
  }, [searchParams, setSelectedLearnerIds]);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm">
          Platform-wide or filtered learner performance across drills, pronunciation, and more
        </p>
      </div>

      <AnalyticsLearnerFilter value={selectedLearnerIds} onChange={setSelectedLearnerIds} />
      <AdminAnalyticsDashboard learnerIds={selectedLearnerIds} />
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <AdminAnalyticsPageContent />
    </Suspense>
  );
}
