"use client";

import React from "react";
import { Plus, Clock, ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useDashboardStats } from "@/hooks/useAdmin";
import { ZERO_PAUSE_PRODUCT_LABELS } from "@/domain/subscriptions/subscription.types";
import { useQuery } from "@tanstack/react-query";
import { adminAPI } from "@/lib/api";

interface DashboardStats {
  totalUsers: number;
  subscribedUsers: number;
  totalActiveLearners: number;
  zeroPauseChallengeUsers: number;
  zeroPauseMaintainerUsers: number;
  newSignupsThisWeek: number;
  discoveryCallsToday: number;
  videosAwaitingReview: number;
}

const Dashboard: React.FC = () => {
  const { data: stats, isLoading: loading } = useDashboardStats();

  const { data: discoveryCallsData, isLoading: callsLoading } = useQuery({
    queryKey: ["admin", "discovery-calls", "recent"],
    queryFn: async () => {
      const res = await adminAPI.getDiscoveryCalls({ limit: 5 });
      return res.data?.calls ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const statsWithDefaults: DashboardStats = stats
    ? {
      totalUsers: stats.totalUsers || 0,
      subscribedUsers: stats.subscribedUsers || 0,
      totalActiveLearners: stats.totalActiveLearners || 0,
      zeroPauseChallengeUsers: stats.zeroPauseChallengeUsers || 0,
      zeroPauseMaintainerUsers: stats.zeroPauseMaintainerUsers || 0,
      newSignupsThisWeek: stats.newSignupsThisWeek || 0,
      discoveryCallsToday: stats.discoveryCallsToday || 0,
      videosAwaitingReview: stats.videosAwaitingReview || 0,
    }
    : {
      totalUsers: 0,
      subscribedUsers: 0,
      totalActiveLearners: 0,
      zeroPauseChallengeUsers: 0,
      zeroPauseMaintainerUsers: 0,
      newSignupsThisWeek: 0,
      discoveryCallsToday: 0,
      videosAwaitingReview: 0,
    };

  const displayStats = [
    {
      title: "Total Signups",
      value: loading ? "..." : statsWithDefaults.totalUsers.toString(),
      change: "",
      color: "bg-white border border-emerald-200 dark:border-border dark:bg-emerald-950/30",
    },
    {
      title: "Eklan Pro Subscribers",
      value: loading ? "..." : statsWithDefaults.subscribedUsers.toString(),
      change: "",
      color: "bg-white border border-blue-200 dark:border-border dark:bg-blue-950/30",
    },
    {
      title: "Total Active Users",
      value: loading ? "..." : statsWithDefaults.totalActiveLearners.toString(),
      change: "",
      color: "bg-white border border-primary-200 dark:border-border dark:bg-primary-950/30",
    },
    {
      title: `${ZERO_PAUSE_PRODUCT_LABELS.challenge} Subscribers`,
      value: loading
        ? "..."
        : statsWithDefaults.zeroPauseChallengeUsers.toString(),
      change: "",
      color: "bg-white border border-violet-200 dark:border-border dark:bg-violet-950/30",
    },
    {
      title: `${ZERO_PAUSE_PRODUCT_LABELS.maintainer} Subscribers`,
      value: loading
        ? "..."
        : statsWithDefaults.zeroPauseMaintainerUsers.toString(),
      change: "",
      color: "bg-white border border-indigo-200 dark:border-border dark:bg-indigo-950/30",
    },
  ];

  const discoveryCalls = discoveryCallsData ?? [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Overview of Eklan operations and learner activity
          </p>
        </div>
        <Link
          href="/admin/drill"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Drill Builder
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayStats.map(
          (
            stat: {
              title: string;
              value: string;
              change: string;
              color: string;
            },
            idx: number,
          ) => (
            <div
              key={idx}
              className={`p-6 rounded-2xl ${stat.color} relative overflow-hidden`}
            >
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-medium text-gray-600 max-w-[120px]">
                  {stat.title}
                </p>
                {stat.change && (
                  <span className="flex items-center text-xs font-bold text-emerald-600">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-4xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ),
        )}
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="p-2 bg-gray-50 rounded-lg">
              <Clock className="w-4 h-4 text-gray-500" />
            </span>
            Upcoming Discovery Calls
          </h2>
          <Link
            href="/admin/discovery-call"
            className="text-sm font-medium text-[#418b43] hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="space-y-4 flex-1">
          {callsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : discoveryCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No upcoming discovery calls</p>
            </div>
          ) : (
            discoveryCalls.map((call: any, idx: number) => (
              <div
                key={call._id ?? idx}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {call.name || call.firstName
                      ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() || call.name
                      : "Unknown"}
                  </h3>
                  <p className="text-xs text-gray-500">{call.purpose ?? call.notes ?? ""}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <Clock className="w-3 h-3" />
                  {call.scheduledAt
                    ? new Date(call.scheduledAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : call.createdAt
                      ? new Date(call.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
