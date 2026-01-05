"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Loader2, BookOpen } from "lucide-react";
import { useLearnerDrills } from "@/hooks/useDrills";
import { DrillCard } from "@/components/drills/DrillCard";
import { getDrillStatus } from "@/utils/drill";

interface DrillItem {
  assignmentId: string;
  drill: {
    _id: string;
    title: string;
    type: string;
    difficulty: string;
    date: string;
    duration_days: number;
    context?: string;
  };
  assignedBy?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  assignedAt: string;
  dueDate: string;
  status: "pending" | "in_progress" | "completed";
  completedAt?: string;
  latestAttempt?: {
    score?: number;
    timeSpent?: number;
    completedAt?: string;
  };
}

// Helper function to determine drill status based on dates

export default function DrillsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "ongoing" | "upcoming" | "completed"
  >("ongoing");

  // Use React Query instead of useEffect + useState
  const {
    data: drills = [],
    isLoading: loading,
    error,
  } = useLearnerDrills({ limit: 100 });

  const handleDrillClick = async (drillId: string, assignmentId?: string) => {
    // Track recent activity
    try {
      await fetch("/api/v1/activities/recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "drill",
          resourceId: drillId,
          action: "viewed",
        }),
      });
    } catch (error) {
      // Silently fail - recent activities is not critical
      console.error("Failed to track activity:", error);
    }

    // Build URL with assignmentId if available
    const url = assignmentId
      ? `/account/drills/${drillId}?assignmentId=${assignmentId}`
      : `/account/drills/${drillId}`;

    router.push(url);
  };

  // Filter drills based on date-based status
  const filteredDrills = drills.filter((item) => {
    const status = getDrillStatus(item);
    if (activeTab === "ongoing") {
      return status === "ongoing" || status === "missed";
    }
    return status === activeTab;
  });

  // Calculate stats based on date-based status
  const stats = {
    ongoing: drills.filter((d) => {
      const status = getDrillStatus(d);
      return status === "ongoing" || status === "missed";
    }).length,
    upcoming: drills.filter((d) => getDrillStatus(d) === "upcoming").length,
    completed: drills.filter((d) => getDrillStatus(d) === "completed").length,
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title="My Drills" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1 mb-6 flex gap-1">
          {(["ongoing", "upcoming", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-[#22c55e] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <span className="capitalize">{tab}</span>
              {stats[tab] > 0 && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {stats[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Drills List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
          </div>
        ) : filteredDrills.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No drills found
            </h3>
            <p className="text-gray-500 text-sm">
              {activeTab === "ongoing"
                ? "You don't have any ongoing drills."
                : activeTab === "upcoming"
                ? "You don't have any upcoming drills."
                : "You haven't completed any drills yet."}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDrills.map((item) => (
              <DrillCard
                key={item.assignmentId}
                drill={item.drill}
                assignmentId={item.assignmentId}
                assignedBy={item.assignedBy}
                dueDate={item.dueDate}
                completedAt={item.completedAt}
                latestAttempt={item.latestAttempt}
                status={item.status}
                variant="detailed"
                onStartClick={handleDrillClick}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
