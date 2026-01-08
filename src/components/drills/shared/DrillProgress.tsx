"use client";

import { Card } from "@/components/ui/Card";

interface DrillProgressProps {
  current: number;
  total: number;
  label?: string;
  gradientFrom?: string;
  gradientTo?: string;
  textColor?: string;
}

/**
 * Shared progress bar component for drills
 * Shows current/total items and percentage completion
 */
export function DrillProgress({
  current,
  total,
  label = "Item",
  gradientFrom = "green-600",
  gradientTo = "green-600",
  textColor = "green-600",
}: DrillProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const gradient = gradientFrom === gradientTo 
    ? `bg-${gradientFrom}` 
    : `bg-gradient-to-r from-${gradientFrom} to-${gradientTo}`;

  return (
    <Card className="mb-4 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
        <span>
          {label} {current} of {total}
        </span>
        <span className={`font-bold text-${textColor}`}>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${gradient} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Card>
  );
}

