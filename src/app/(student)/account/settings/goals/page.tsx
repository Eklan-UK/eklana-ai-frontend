"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Briefcase,
  Plane,
  GraduationCap,
  Users,
  TrendingUp,
  Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { userAPI } from "@/lib/api";
import { toast } from "sonner";

const SETTINGS_GOAL_IDS = new Set([
  "speak",
  "travel",
  "academic",
  "social",
  "career",
]);

export default function SettingsGoalsPage() {
  const queryClient = useQueryClient();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const goals = [
    {
      id: "speak",
      label: "Speak confidently in meetings",
      Icon: Briefcase,
      description: "Improve your professional communication skills",
    },
    {
      id: "travel",
      label: "Travel and communicate abroad",
      Icon: Plane,
      description: "Master travel-related conversations",
    },
    {
      id: "academic",
      label: "Academic success",
      Icon: GraduationCap,
      description: "Excel in academic English settings",
    },
    {
      id: "social",
      label: "Make friends and socialize",
      Icon: Users,
      description: "Build confidence in social situations",
    },
    {
      id: "career",
      label: "Advance my career",
      Icon: TrendingUp,
      description: "Enhance your professional opportunities",
    },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await userAPI.getCurrent({ cache: false });
        const p = (res as {
          profile?: {
            learningGoals?: string[];
            learningGoal?: string;
          };
        }).profile;
        if (!mounted) return;
        if (p?.learningGoals && p.learningGoals.length > 0) {
          setSelectedGoals(
            p.learningGoals.filter((id) => SETTINGS_GOAL_IDS.has(id))
          );
        } else if (p?.learningGoal && SETTINGS_GOAL_IDS.has(p.learningGoal)) {
          setSelectedGoals([p.learningGoal]);
        } else {
          setSelectedGoals([]);
        }
      } catch {
        toast.error("Could not load your profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId)
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await userAPI.updatePreferences({
        learningGoals: selectedGoals,
        learningGoal: selectedGoals[0],
      });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6"></div>

      <Header showBack title="Learning Goals" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <div className="mb-6">
          <p className="text-base text-gray-600">
            Select your learning goals to personalize your experience. You can
            choose multiple goals.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {goals.map((goal) => {
            const Icon = goal.Icon;
            const isSelected = selectedGoals.includes(goal.id);

            return (
              <button
                key={goal.id}
                onClick={() => toggleGoal(goal.id)}
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
                        isSelected ? "bg-green-100" : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isSelected ? "text-green-600" : "text-gray-600"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {goal.label}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {goal.description}
                      </p>
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
          disabled={loading || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save goals"}
        </Button>

        <Card className="mt-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Why set goals?
              </p>
              <p className="text-xs text-gray-600">
                Your goals help us personalize your learning path and recommend
                the best practice exercises for you.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
