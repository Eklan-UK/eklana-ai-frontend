"use client";

import React, { useMemo } from "react";
import { BarChart3, BookOpen, Mic, User } from "lucide-react";
import { useAllLearners } from "@/hooks/useAdmin";
import { AnalyticsProgressSummary } from "@/components/admin/analytics-progress-summary";
import { AnalyticsDrillProgressStats } from "@/components/admin/analytics-drill-progress-stats";
import { AnalyticsPronunciationSection } from "@/components/admin/analytics-pronunciation-section";
import { GrammarAnalyticsComponent } from "@/components/admin/grammar-analytics";
import { SentenceAnalyticsComponent } from "@/components/admin/sentence-analytics";
import { MatchingAnalyticsComponent } from "@/components/admin/matching-analytics";
import { PlatformFillBlankAnalytics } from "@/components/admin/platform-fill-blank-analytics";
import { PlatformKeyPhrasesAnalytics } from "@/components/admin/platform-key-phrases-analytics";
import { LearnerProfileAnalytics } from "@/components/shared/learner-profile-analytics";

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

  const selectedLearners = useMemo(() => {
    return learnerIds.map((id) => {
      const learner = learners.find((l: { _id: string }) => l._id === id);
      return {
        id,
        name: learner ? learnerDisplayName(learner) : "Unknown",
      };
    });
  }, [learnerIds, learners]);

  if (learnerIds.length === 0) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-gray-500">
          Viewing analytics for: <span className="font-medium text-gray-700">All learners</span>
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Overall Progress
          </h2>
          <AnalyticsProgressSummary learnerIds={[]} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Drill Progress
          </h2>
          <AnalyticsDrillProgressStats learnerIds={[]} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Mic className="w-5 h-5" /> Pronunciation Analytics
          </h2>
          <AnalyticsPronunciationSection learnerIds={[]} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <GrammarAnalyticsComponent learnerId="" learnerIds={[]} hideProblemAreas />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <SentenceAnalyticsComponent learnerId="" learnerIds={[]} hideProblemAreas />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <MatchingAnalyticsComponent learnerId="" learnerIds={[]} hideConfusions hideResponseSpeed />
        </div>

        <PlatformFillBlankAnalytics />

        <PlatformKeyPhrasesAnalytics />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-gray-500">
        Viewing analytics for:{" "}
        <span className="font-medium text-gray-700">
          {selectedLearners.length === 1
            ? selectedLearners[0].name
            : `${selectedLearners.length} learners selected`}
        </span>
      </p>

      {selectedLearners.map(({ id, name }) => (
        <div key={id} className="space-y-1">
          {selectedLearners.length > 1 && (
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <User className="w-4 h-4 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-800">{name}</h2>
            </div>
          )}
          <LearnerProfileAnalytics learnerId={id} learnerName={name} />
        </div>
      ))}
    </div>
  );
}
