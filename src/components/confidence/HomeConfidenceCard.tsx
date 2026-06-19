'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useProgressScorecard } from '@/hooks/useProgressScorecard';

export function HomeConfidenceCard() {
  const { data: scorecard, isLoading } = useProgressScorecard();

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-muted rounded-lg" />
            <div className="space-y-2">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          </div>
          <div className="w-16 h-16 rounded-full bg-muted" />
        </div>
      </Card>
    );
  }

  const score = scorecard?.confidence ?? 0;
  const weeklyChange = scorecard?.confidenceWeeklyChange ?? 0;
  const isPositive = weeklyChange >= 0;
  const absChange = Math.abs(weeklyChange);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-medium font-satoshi text-foreground">
              Confidence
            </p>
            <p className={`text-xs flex items-center gap-1 mt-1 ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {isPositive ? '+' : '-'}{absChange}% this week
            </p>
          </div>
        </div>

        <div className="relative w-16 h-16">
          <svg
            className="transform -rotate-90"
            width="64"
            height="64"
            viewBox="0 0 64 64"
          >
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-border"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#eab308"
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-yellow-600">
              {score}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
