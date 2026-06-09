"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Flame, Clock, Target, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useLearnerDrills } from "@/hooks/useDrills";
import { useWeeklyChallenge } from "@/hooks/useWeeklyChallenge";
import { ContinuePracticeCard } from "@/components/practice/ContinuePracticeCard";
import { WeeklyChallengeCard } from "@/components/weekly-challenge/WeeklyChallengeCard";
import { isSundayUtc } from "@/lib/challenges/utc-week-challenge";

interface DailyFocus {
  _id: string;
  title: string;
  focusType: string;
  practiceFormat: string;
  description?: string;
  date: string;
  estimatedMinutes: number;
  difficulty: string;
  totalQuestions: number;
}

interface PersonalizationPayload {
  summary: string;
  signalsUsed: string[];
  candidateCount?: number;
}

const focusTypeLabels: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  matching: "Matching",
  pronunciation: "Pronunciation",
  general: "General Practice",
};

export function TodaysFocusCard() {
  // TEMP: force Sunday for demo — revert to: const isSunday = isSundayUtc();
  const isSunday = true;
  const { data: weeklyChallenge } = useWeeklyChallenge(undefined, { enabled: isSunday });
  const { data: drillsData, isLoading: drillsLoading } = useLearnerDrills();

  const activeDrills = (drillsData ?? []).filter(
    (a: any) => a.status === "pending" || a.status === "in_progress"
  );
  const inProgressDrill = activeDrills.find((a: any) => a.status === "in_progress");
  const continueDrill = inProgressDrill || activeDrills[0];

  const [dailyFocus, setDailyFocus] = useState<DailyFocus | null>(null);
  const [personalization, setPersonalization] =
    useState<PersonalizationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCompleted, setTodayCompleted] = useState(false);

  useEffect(() => {
    fetchTodaysFocus();
    checkCompletionStatus();
  }, []);

  const checkCompletionStatus = async () => {
    // Streak is disabled - always show as not completed
    setTodayCompleted(false);
  };

  const fetchTodaysFocus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/daily-focus/today", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch today's focus");
      }

      const data = await response.json();
      setError(null);
      setDailyFocus(data.dailyFocus);
      setPersonalization(data.personalization ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (
    isSunday &&
    weeklyChallenge?.status === "ready" &&
    (weeklyChallenge.drillSequence?.length ?? 0) > 0
  ) {
    return <WeeklyChallengeCard challenge={weeklyChallenge} />;
  }

  if (
    isSunday &&
    (weeklyChallenge?.status === "generating" || weeklyChallenge?.status === "failed")
  ) {
    return <WeeklyChallengeCard challenge={weeklyChallenge} />;
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white mb-6 md:mb-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-amber-200 bg-amber-50 text-amber-950 mb-6 md:mb-8 p-4 text-sm">
        {error}
      </Card>
    );
  }

  if (!dailyFocus) {
    if (drillsLoading) {
      return (
        <div
          className="mb-6 md:mb-8 rounded-3xl bg-gradient-to-br from-emerald-600/35 to-emerald-700/35 animate-pulse min-h-[220px]"
          aria-hidden
        />
      );
    }

    if (continueDrill) {
      return (
        <ContinuePracticeCard
          drill={continueDrill}
          isResume={!!inProgressDrill}
        />
      );
    }

    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white mb-6 md:mb-8">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="bg-green-500 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <Flame className="w-3 h-3" /> FOCUS TODAY
        </span>
        <span className="bg-green-500/50 px-3 py-1 rounded-full text-xs font-semibold capitalize">
          {focusTypeLabels[dailyFocus.focusType] || dailyFocus.focusType}
        </span>
      </div>
      
      <h2 className="text-3xl md:text-4xl font-bold mb-2">{dailyFocus.title}</h2>

      {personalization?.summary ? (
        <p className="text-green-50/95 text-sm md:text-base leading-relaxed mb-3 border-l-2 border-green-300/80 pl-3">
          {personalization.summary}
        </p>
      ) : null}
      
      {dailyFocus.description && (
        <p className="text-green-100 mb-4">{dailyFocus.description}</p>
      )}
      
      <div className="flex items-center gap-4 text-sm text-green-100 mb-6">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{dailyFocus.estimatedMinutes} minutes</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1">
          <Target className="w-4 h-4" />
          <span className="capitalize">{dailyFocus.difficulty}</span>
        </div>
        <span>•</span>
        <span>{dailyFocus.totalQuestions} questions</span>
      </div>
      
      {todayCompleted ? (
        <>
          <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-green-500/30 rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Completed Today!</span>
          </div>
          <Link href={`/account/daily-focus/${dailyFocus._id}`}>
            <Button
              variant="outline"
              size="lg"
              fullWidth
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 mb-4"
            >
              Practice Again
            </Button>
          </Link>
          <p className="text-xs text-green-100 text-center">
            Great job! You can practice again to improve your skills.
          </p>
        </>
      ) : (
        <>
          <Link href={`/account/daily-focus/${dailyFocus._id}`}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 mb-4"
            >
              Start Today&apos;s Practice
            </Button>
          </Link>
          <p className="text-xs text-green-100 text-center">
            Complete today&apos;s focus to maintain your streak!
          </p>
        </>
      )}
    </Card>
  );
}

