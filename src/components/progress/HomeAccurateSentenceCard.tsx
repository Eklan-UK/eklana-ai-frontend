"use client";

import React from "react";
import { MessageSquareText, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useHomeProgress } from "@/hooks/useHomeProgress";

export function HomeAccurateSentenceCard() {
  const { data: metrics, isLoading } = useHomeProgress();

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
          </div>
          <div className="w-14 h-14 rounded-full bg-gray-200" />
        </div>
      </Card>
    );
  }

  const score = metrics?.accurateSentenceUsage ?? 0;
  const weeklyChange = metrics?.sentenceWeeklyChange ?? 0;
  const validScore = Math.max(0, Math.min(100, score));
  const isPositive = weeklyChange >= 0;
  const absChange = Math.abs(weeklyChange);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (validScore / 100) * circumference;

  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center">
            <MessageSquareText className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-bold font-satoshi text-gray-900">
              Accurate Sentence Usage
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
              stroke="#f3f4f6"
              strokeWidth="5"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#0284c7"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-extrabold font-nunito text-gray-900">
              {Math.round(validScore)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
