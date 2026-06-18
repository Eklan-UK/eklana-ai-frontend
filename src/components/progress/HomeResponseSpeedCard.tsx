"use client";

import React from "react";
import { MessageSquare, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useProgressScorecard } from "@/hooks/useProgressScorecard";

export function HomeResponseSpeedCard() {
  const { data: scorecard, isLoading } = useProgressScorecard();

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-muted rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
          <div className="w-14 h-14 rounded-full bg-muted" />
        </div>
      </Card>
    );
  }

  const score = Math.max(0, Math.min(100, scorecard?.fluency ?? 0));
  const weeklyChange = scorecard?.fluencyWeeklyChange ?? 0;
  const isPositive = weeklyChange >= 0;
  const absChange = Math.abs(weeklyChange);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold font-satoshi text-foreground">
              Fluency
            </p>
            <div
              className={`text-xs flex items-center gap-1 mt-0.5 font-medium ${
                isPositive ? "text-green-600" : "text-red-500"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>
                {isPositive ? "+" : "-"}
                {absChange}% this week
              </span>
            </div>
          </div>
        </div>

        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              className="text-muted"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#7c3aed"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-extrabold font-nunito text-foreground">
              {score}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
