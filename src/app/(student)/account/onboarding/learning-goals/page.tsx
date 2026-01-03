"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MessageCircle, Briefcase, Plane, FileText, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OnboardingLearningGoalsPage() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const goals = [
    {
      id: "conversations",
      label: "Speak naturally in conversations",
      Icon: MessageCircle,
      description: "Improve your everyday speaking skills",
    },
    {
      id: "professional",
      label: "Sound professional at work",
      Icon: Briefcase,
      description: "Enhance your workplace communication",
    },
    {
      id: "travel",
      label: "Travel confidently",
      Icon: Plane,
      description: "Master travel-related conversations",
    },
    {
      id: "interviews",
      label: "Prepare for Interviews",
      Icon: FileText,
      description: "Ace your job interviews",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-8 h-2 bg-green-600 rounded-full"></div>
        <div className="w-8 h-2 bg-green-600 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-lg md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Why are you learning English?
          </h1>
          <p className="text-base text-gray-600">
            Select the main reason to personalize your learning experience
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {goals.map((goal) => {
            const Icon = goal.Icon;
            const isSelected = selectedGoal === goal.id;

            return (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal.id)}
                className="w-full text-left"
              >
                <Card
                  className={`transition-all ${
                    isSelected
                      ? "bg-green-50 ring-2 ring-green-600"
                      : "hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isSelected ? "bg-green-100" : "bg-blue-100"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isSelected ? "text-green-600" : "text-blue-600"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {goal.label}
                      </h3>
                      <p className="text-xs text-gray-500">{goal.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedGoal}
          onClick={() => router.push("/account/onboarding/nationality")}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

