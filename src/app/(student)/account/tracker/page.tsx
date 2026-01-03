"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Calendar, TrendingUp, Target, Award, Check } from "lucide-react";

export default function TrackerPage() {
  const weeklyProgress = [
    { day: "S", completed: true },
    { day: "M", completed: true },
    { day: "T", completed: true },
    { day: "W", completed: false },
    { day: "T", completed: false },
    { day: "F", completed: false },
    { day: "S", completed: false },
  ];

  const stats = [
    { label: "Current Streak", value: "3 days", icon: TrendingUp },
    { label: "Longest Streak", value: "7 days", icon: Award },
    { label: "Total Practice", value: "12 hours", icon: Target },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Progress Tracker" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Streak Display */}
        <Card className="mb-6 bg-gradient-to-br from-orange-50 to-yellow-50">
          <div className="text-center py-8">
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-5xl font-bold text-white">3</span>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 px-3 py-1 rounded-full">
                <span className="text-sm font-semibold text-gray-900">
                  Day Streak
                </span>
              </div>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              Keep it going! 🔥
            </p>
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="text-center">
                <div className="flex justify-center mb-2">
                  <Icon className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </Card>
            );
          })}
        </div>

        {/* Monthly Calendar */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Monthly View</h3>
            <Calendar className="w-5 h-5 text-gray-600" />
          </div>
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Calendar view coming soon</p>
          </div>
        </Card>

        {/* Action Button */}
        <Button variant="primary" size="lg" fullWidth>
          Continue Practice
        </Button>
      </div>
    </div>
  );
}
