"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AnalyticsLearnerFilter } from "@/components/admin/analytics-learner-filter";
import { AdminAnalyticsDashboard } from "@/components/admin/admin-analytics-dashboard";

function TutorAnalyticsPageContent() {
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
      router.replace(qs ? `/tutor/analytics?${qs}` : "/tutor/analytics", { scroll: false });
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
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm">
          Performance across your assigned students — drills, pronunciation, and more
        </p>
      </div>

      <AnalyticsLearnerFilter
        value={selectedLearnerIds}
        onChange={setSelectedLearnerIds}
        learnerSource="tutor"
      />
      <AdminAnalyticsDashboard learnerIds={selectedLearnerIds} learnerSource="tutor" />
    </div>
  );
}

export default function TutorAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <TutorAnalyticsPageContent />
    </Suspense>
  );
}
