"use client";

import type { ComponentType } from "react";
import { Briefcase, FileText, MessageCircle, Plane } from "lucide-react";
import { Card } from "@/components/ui/Card";

export type LearningGoalItem = {
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
};

export const LEARNING_GOAL_ITEMS: LearningGoalItem[] = [
  {
    id: "conversations",
    label: "Speak naturally in conversations",
    Icon: MessageCircle,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    id: "professional",
    label: "Sound professional at work",
    Icon: Briefcase,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-800",
  },
  {
    id: "travel",
    label: "Travel confidently",
    Icon: Plane,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
  },
  {
    id: "interviews",
    label: "Prepare for Interviews",
    Icon: FileText,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
];

type LearningGoalCardsProps = {
  selectedId: string | null;
  onSelect: (goalId: string) => void;
};

export function LearningGoalCards({ selectedId, onSelect }: LearningGoalCardsProps) {
  return (
    <div className="space-y-3">
      {LEARNING_GOAL_ITEMS.map((goal) => {
        const Icon = goal.Icon;
        const isSelected = selectedId === goal.id;

        return (
          <button
            key={goal.id}
            type="button"
            onClick={() => onSelect(goal.id)}
            className="w-full text-left"
          >
            <Card
              className={`transition-all bg-white ${
                isSelected
                  ? "border-2 border-green-600 shadow-sm"
                  : "border border-border hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center ${goal.iconBg}`}
                >
                  <Icon className={`w-6 h-6 ${goal.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 flex-1 min-w-0">
                  {goal.label}
                </h3>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
