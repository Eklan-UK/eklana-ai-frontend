"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Briefcase,
  Plane,
  GraduationCap,
  Users,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function GoalsPage() {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const goals = [
    { id: "speak", label: "Speak confidently in meetings", Icon: Briefcase },
    { id: "travel", label: "Travel and communicate abroad", Icon: Plane },
    { id: "academic", label: "Academic success", Icon: GraduationCap },
    { id: "social", label: "Make friends and socialize", Icon: Users },
    { id: "career", label: "Advance my career", Icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Learning Goals" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-2xl md:px-8">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-2 bg-green-600 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            What&apos;s your main goal?
          </h1>
          <p className="text-base text-gray-600">
            Choose the goal that best describes what you want to achieve
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {goals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => setSelectedGoal(goal.id)}
              className={`w-full text-left ${
                selectedGoal === goal.id
                  ? "ring-2 ring-green-600"
                  : "ring-1 ring-gray-200"
              }`}
            >
              <Card
                className={`transition-all ${
                  selectedGoal === goal.id ? "bg-green-50" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <goal.Icon className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-gray-900">
                      {goal.label}
                    </p>
                  </div>
                  {selectedGoal === goal.id && (
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M13 4L6 11L3 8"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedGoal}
          onClick={() => {
            // Navigate to next step
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
