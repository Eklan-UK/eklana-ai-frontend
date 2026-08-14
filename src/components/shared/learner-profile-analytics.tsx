"use client";

import {
  BookOpen,
  Mic,
  MessageSquare,
  BarChart3,
  Trophy,
} from "lucide-react";
import { PronunciationAnalyticsComponent } from "@/components/admin/pronunciation-analytics";
import { GrammarAnalyticsComponent } from "@/components/admin/grammar-analytics";
import { SentenceAnalyticsComponent } from "@/components/admin/sentence-analytics";
import { MatchingAnalyticsComponent } from "@/components/admin/matching-analytics";
import { FillBlankAnalyticsComponent } from "@/components/admin/fill-blank-analytics";
import { KeyPhrasesAnalyticsComponent } from "@/components/admin/key-phrases-analytics";
import { DrillSubmissionsComponent } from "@/components/admin/drill-submissions";
import { LearnerFreeTalkAttemptsSection } from "@/components/admin/learner-free-talk-attempts";
import { LearnerWeeklyChallengeStatus } from "@/components/admin/learner-weekly-challenge-status";
import { LearnerProgressSummary } from "@/components/admin/learner-progress-summary";

interface LearnerProfileAnalyticsProps {
  learnerId: string;
  learnerName: string;
}

/**
 * Full analytics suite for a learner profile.
 * Used by both the admin learner page and the tutor student page.
 */
export function LearnerProfileAnalytics({
  learnerId,
  learnerName,
}: LearnerProfileAnalyticsProps) {
  return (
    <div className="space-y-6">
      {/* Overall Progress Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Overall Progress
        </h2>
        <LearnerProgressSummary learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Eklan Free Talk */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Eklan Simulation Room
        </h2>
        <LearnerFreeTalkAttemptsSection learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Weekly Challenge Status */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Trophy className="w-5 h-5" /> Weekly Challenges
        </h2>
        <LearnerWeeklyChallengeStatus learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Drill Submissions & Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Assigned Drills & Submissions
        </h2>
        <DrillSubmissionsComponent learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Pronunciation Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Mic className="w-5 h-5" /> Pronunciation Analytics
        </h2>
        <PronunciationAnalyticsComponent learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Grammar Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <GrammarAnalyticsComponent learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Sentence Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <SentenceAnalyticsComponent learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Matching Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <MatchingAnalyticsComponent learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Fill in the Blank Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <FillBlankAnalyticsComponent learnerId={learnerId} learnerName={learnerName} />
      </div>

      {/* Key Phrase Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <KeyPhrasesAnalyticsComponent learnerId={learnerId} learnerName={learnerName} />
      </div>
    </div>
  );
}
