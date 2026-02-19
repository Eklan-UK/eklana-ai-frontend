"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { getRecentActivities } from "@/utils/activity-cache";
import { Clock, BookOpen, Mic, MessageSquare, PenTool, RotateCcw } from "lucide-react";
import Link from "next/link";

interface CachedActivity {
  type: string;
  resourceId: string;
  action: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

// Map activity types to icons and colors
const getActivityIcon = (type: string) => {
  switch (type) {
    case "drill":
      return { icon: BookOpen, color: "bg-blue-100", iconColor: "text-blue-600" };
    case "pronunciation":
      return { icon: Mic, color: "bg-green-100", iconColor: "text-green-600" };
    case "roleplay":
      return { icon: MessageSquare, color: "bg-primary-100", iconColor: "text-primary-600" };
    case "summary":
      return { icon: PenTool, color: "bg-orange-100", iconColor: "text-orange-600" };
    default:
      return { icon: Clock, color: "bg-gray-100", iconColor: "text-gray-600" };
  }
};

// Format relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
};

// Format activity title
const formatActivityTitle = (activity: CachedActivity): string => {
  const action = activity.action;
  const type = activity.type;
  const title = activity.metadata?.title || activity.metadata?.drillTitle;

  if (title) {
    return title;
  }

  // Generate title from action and type
  switch (action) {
    case "started":
      return `Started ${type} practice`;
    case "completed":
      return `Completed ${type}`;
    case "viewed":
      return `Viewed ${type}`;
    default:
      return `${action} ${type}`;
  }
};

export function RecentActivities({ limit = 4 }: { limit?: number }) {
  const [activities, setActivities] = useState<CachedActivity[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Get activities from local storage
    const recentActivities = getRecentActivities(limit);
    setActivities(recentActivities);
  }, [limit]);

  // Don't render anything on server
  if (!mounted) {
    return (
      <div className="space-y-3">
        {/* Skeleton placeholders */}
        {[1, 2].map((i) => (
          <Card key={i}>
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="text-center py-8">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 text-sm">No recent activity</p>
        <p className="text-gray-400 text-xs mt-1">
          Start practicing to see your activity here
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => {
        const { icon: Icon, color, iconColor } = getActivityIcon(activity.type);
        const score = activity.metadata?.score;

        return (
          <Card key={`${activity.resourceId}-${activity.timestamp}-${index}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatActivityTitle(activity)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {score !== undefined && <span>{score}% • </span>}
                    {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </div>
              {activity.type === "drill" && (
                <Link
                  href={`/account/drills/${activity.resourceId}`}
                  className="text-blue-600 flex items-center gap-1 text-sm font-medium hover:text-blue-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Redo
                </Link>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

