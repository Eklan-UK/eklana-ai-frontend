"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Flame, Clock, Target, Loader2, Calendar, CheckCircle } from "lucide-react";
import Link from "next/link";
import { streakAPI } from "@/lib/api";

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

const focusTypeLabels: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  matching: "Matching",
  pronunciation: "Pronunciation",
  general: "General Practice",
};

export function TodaysFocusCard() {
  const [dailyFocus, setDailyFocus] = useState<DailyFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCompleted, setTodayCompleted] = useState(false);

  useEffect(() => {
    fetchTodaysFocus();
    checkCompletionStatus();
  }, []);

  const checkCompletionStatus = async () => {
    try {
      const response = await streakAPI.getStreak();
      const data = response.data || response;
      setTodayCompleted(data.todayCompleted || false);
    } catch (error) {
      console.error("Failed to check completion status:", error);
    }
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
      setDailyFocus(data.dailyFocus);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white mb-6 md:mb-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      </Card>
    );
  }

  if (!dailyFocus) {
    return (
      <Card className="bg-gradient-to-br from-gray-600 to-gray-700 text-white mb-6 md:mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-gray-500 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <Calendar className="w-3 h-3" /> TODAY&apos;S FOCUS
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-2">No Focus Today</h2>
        <p className="text-gray-200 mb-4">
          Check back later for today&apos;s practice content.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white mb-6 md:mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-green-500 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <Flame className="w-3 h-3" /> TODAY&apos;S FOCUS
        </span>
        <span className="bg-green-500/50 px-3 py-1 rounded-full text-xs font-semibold capitalize">
          {focusTypeLabels[dailyFocus.focusType] || dailyFocus.focusType}
        </span>
      </div>
      
      <h2 className="text-3xl md:text-4xl font-bold mb-2">{dailyFocus.title}</h2>
      
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

