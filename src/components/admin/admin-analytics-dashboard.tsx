"use client";

import React, { useMemo } from "react";
import { BarChart3, BookOpen, Mic } from "lucide-react";
import { useAllLearners } from "@/hooks/useAdmin";
import { AnalyticsProgressSummary } from "@/components/admin/analytics-progress-summary";
import { AnalyticsDrillProgressStats } from "@/components/admin/analytics-drill-progress-stats";
import { AnalyticsPronunciationSection } from "@/components/admin/analytics-pronunciation-section";
import { GrammarAnalyticsComponent } from "@/components/admin/grammar-analytics";
import { SentenceAnalyticsComponent } from "@/components/admin/sentence-analytics";
import { MatchingAnalyticsComponent } from "@/components/admin/matching-analytics";
import { FillBlankAnalyticsComponent } from "@/components/admin/fill-blank-analytics";
import { KeyPhrasesAnalyticsComponent } from "@/components/admin/key-phrases-analytics";
import { PlatformFillBlankAnalytics } from "@/components/admin/platform-fill-blank-analytics";
import { PlatformKeyPhrasesAnalytics } from "@/components/admin/platform-key-phrases-analytics";

interface AdminAnalyticsDashboardProps {
  learnerIds: string[];
}

function learnerDisplayName(learner: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
}) {
  const fromParts = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim();
  return fromParts || learner.name || learner.email || "Unknown";
}

export function AdminAnalyticsDashboard({ learnerIds }: AdminAnalyticsDashboardProps) {
  const { data: learnersData } = useAllLearners({ limit: 1000 });
  const learners = learnersData?.learners ?? [];

  const contextLabel = useMemo(() => {
    if (learnerIds.length === 0) {
      return "All learners";
    }
    if (learnerIds.length === 1) {
      const learner = learners.find((l: { _id: string }) => l._id === learnerIds[0]);
      return learner ? learnerDisplayName(learner) : "1 learner selected";
    }
    return `${learnerIds.length} learners selected`;
  }, [learnerIds, learners]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Viewing analytics for: <span className="font-medium text-gray-700">{contextLabel}</span>
      </p>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Overall Progress
        </h2>
        <AnalyticsProgressSummary learnerIds={learnerIds} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Drill Progress
        </h2>
        <AnalyticsDrillProgressStats learnerIds={learnerIds} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Mic className="w-5 h-5" /> Pronunciation Analytics
        </h2>
        <AnalyticsPronunciationSection learnerIds={learnerIds} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <GrammarAnalyticsComponent
          learnerId={learnerIds.length === 1 ? learnerIds[0] : ""}
          learnerIds={learnerIds}
          hideProblemAreas
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <SentenceAnalyticsComponent
          learnerId={learnerIds.length === 1 ? learnerIds[0] : ""}
          learnerIds={learnerIds}
          hideProblemAreas
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <MatchingAnalyticsComponent
          learnerId={learnerIds.length === 1 ? learnerIds[0] : ""}
          learnerIds={learnerIds}
          hideConfusions
          hideResponseSpeed
        />
      </div>

      {learnerIds.length === 1 ? (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <FillBlankAnalyticsComponent
              learnerId={learnerIds[0]}
              learnerIds={learnerIds}
            />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <KeyPhrasesAnalyticsComponent
              learnerId={learnerIds[0]}
              learnerIds={learnerIds}
            />
          </div>
        </>
      ) : (
        <>
          <PlatformFillBlankAnalytics
            days={30}
            learnerIds={learnerIds.length > 0 ? learnerIds : undefined}
          />
          <PlatformKeyPhrasesAnalytics
            days={30}
            learnerIds={learnerIds.length > 0 ? learnerIds : undefined}
          />
        </>
      )}
    </div>
  );
}
