"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Flame, Check, Calendar, Award, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function StreakPage() {
  const currentStreak = 1;
  const weeklyProgress = [
    { day: "S", label: "Sunday", completed: true },
    { day: "M", label: "Monday", completed: false },
    { day: "T", label: "Tuesday", completed: false },
    { day: "W", label: "Wednesday", completed: false },
    { day: "T", label: "Thursday", completed: false },
    { day: "F", label: "Friday", completed: false },
    { day: "S", label: "Saturday", completed: false },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Streak" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Streak Display */}
        <Card className="mb-6 bg-gradient-to-br from-orange-50 to-yellow-50">
          <div className="text-center py-8">
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                <Flame className="w-16 h-16 text-white" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 px-4 py-1 rounded-full">
                <span className="text-2xl font-bold text-gray-900">
                  {currentStreak}
                </span>
              </div>
            </div>
            <p className="text-xl font-bold text-yellow-600 mb-2">Day Streak</p>
            <p className="text-sm text-gray-600">Keep it going!</p>
          </div>
        </Card>

        {/* Weekly Progress */}
        <Card className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">This Week</h3>
          <div className="grid grid-cols-7 gap-2">
            {weeklyProgress.map((day, index) => (
              <div key={index} className="text-center">
                <div className="text-xs font-medium text-gray-600 mb-2">
                  {day.day}
                </div>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${
                    day.completed
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {day.completed ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Motivation Banner */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🦊</div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Your habit and streak journey starts now!
              </p>
              <p className="text-xs text-gray-600">
                Practice every day to build your streak and unlock rewards.
              </p>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="text-center">
            <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">1</p>
            <p className="text-xs text-gray-500">Current Streak</p>
          </Card>
          <Card className="text-center">
            <Award className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">Longest Streak</p>
          </Card>
        </div>

        {/* Action Button */}
        <Button variant="primary" size="lg" fullWidth>
          See Review
        </Button>
      </div>
    </div>
  );
}

