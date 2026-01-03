"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  BookOpen,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Target,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { drillAPI } from "@/lib/api";
import { toast } from "sonner";

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
function getDrillStatus(
  item: DrillItem
): "ongoing" | "upcoming" | "completed" | "missed" {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Check if completed
  if (item.completedAt || (item.status as string) === "completed") {
    return "completed";
  }

  // Use assignment dueDate if available, otherwise calculate from drill date + duration
  const dueDate = item.dueDate
    ? new Date(item.dueDate)
    : (() => {
        const endDate = new Date(item.drill.date);
        endDate.setDate(
          endDate.getDate() + (item.drill.duration_days || 1) - 1
        );
        return endDate;
      })();
  dueDate.setHours(23, 59, 59, 999);

  const startDate = new Date(item.drill.date);
  startDate.setHours(0, 0, 0, 0);

  // Check if drill is missed (due date has passed and not completed)
  if (
    now > dueDate &&
    !item.completedAt &&
    (item.status as string) !== "completed"
  ) {
    return "missed";
  }

  // Check if drill is ongoing (today is within the date range)
  if (now >= startDate && now <= dueDate) {
    return "ongoing";
  }

  // Check if drill is upcoming (start date is in the future)
  if (startDate > now) {
    return "upcoming";
  }

  // Default to ongoing if past start date but before due date
  return "ongoing";
}

export default function DrillsPage() {
  const router = useRouter();
  const [drills, setDrills] = useState<DrillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "ongoing" | "upcoming" | "completed"
  >("ongoing");

  useEffect(() => {
    loadDrills();
  }, []);

  const loadDrills = async () => {
    try {
      setLoading(true);
      // Load all drills - we'll filter by status on the client side
      // Cache is enabled by default in apiRequest
      const response: any = await drillAPI.getLearnerDrills({ limit: 100 });

      // Handle different response structures
      let drillsData: DrillItem[] = [];

      if (response.data?.drills) {
        drillsData = response.data.drills;
      } else if (response.drills) {
        drillsData = response.drills;
      } else if (Array.isArray(response)) {
        drillsData = response;
      }

      // Ensure drills have the correct structure
      drillsData = drillsData.map((item: any) => {
        // Handle case where drill might be nested differently
        if (item.drill && typeof item.drill === "object") {
          return item;
        }
        // If drill data is at top level, restructure it
        if (item._id && item.title) {
          return {
            assignmentId: item.assignmentId || item._id,
            drill: item,
            assignedBy: item.assignedBy,
            assignedAt: item.assignedAt || item.created_date,
            dueDate:
              item.dueDate ||
              new Date(
                new Date(item.date).getTime() +
                  (item.duration_days || 1) * 24 * 60 * 60 * 1000
              ).toISOString(),
            status: item.status || "pending",
            completedAt: item.completedAt,
            latestAttempt: item.latestAttempt,
          };
        }
        return item;
      });

      setDrills(drillsData);
    } catch (error: any) {
      console.error("Error loading drills:", error);
      toast.error(
        "Failed to load drills: " + (error.message || "Unknown error")
      );
      setDrills([]);
    } finally {
      setLoading(false);
    }
  };

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

  const getDrillIcon = (type: string): string => {
    const icons: Record<string, string> = {
      vocabulary: "📚",
      roleplay: "💬",
      matching: "🔗",
      definition: "📖",
      summary: "📝",
      grammar: "✏️",
      sentence_writing: "✍️",
    };
    return icons[type] || "📚";
  };

  const getStatusBadge = (item: DrillItem) => {
    const status = getDrillStatus(item);

    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case "ongoing":
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Ongoing
          </span>
        );
      case "upcoming":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Upcoming
          </span>
        );
      case "missed":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Missed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Pending
          </span>
        );
    }
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
            {filteredDrills.map((item) => {
              const drill = item.drill;
              const dueDate = item.dueDate
                ? new Date(item.dueDate)
                : (() => {
                    const endDate = new Date(item.drill.date);
                    endDate.setDate(
                      endDate.getDate() + (item.drill.duration_days || 1) - 1
                    );
                    return endDate;
                  })();
              const status = getDrillStatus(item);
              const isOverdue = status === "missed";

              return (
                <Card
                  key={item.assignmentId}
                  className="p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="flex items-start gap-3 flex-1 cursor-pointer"
                      onClick={() =>
                        handleDrillClick(drill._id, item.assignmentId)
                      }
                    >
                      <span className="text-2xl">
                        {getDrillIcon(drill.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 truncate">
                          {drill.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 capitalize">
                            {drill.type}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Target className="w-3 h-3" />
                            <span className="capitalize">
                              {drill.difficulty}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(item)}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Due: {dueDate.toLocaleDateString()}</span>
                    </div>
                    {item.latestAttempt?.score !== undefined && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Score: {item.latestAttempt.score}%</span>
                      </div>
                    )}
                  </div>

                  {isOverdue && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
                      <p className="text-xs text-red-700">
                        This drill is overdue
                      </p>
                    </div>
                  )}

                  {item.assignedBy && (
                    <p className="text-xs text-gray-400 mb-3">
                      Assigned by: {item.assignedBy.firstName}{" "}
                      {item.assignedBy.lastName}
                    </p>
                  )}

                  {/* Start Button */}
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrillClick(drill._id, item.assignmentId);
                      }}
                      className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                    >
                      Start
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
