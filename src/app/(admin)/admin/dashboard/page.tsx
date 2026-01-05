"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Clock,
  CheckCircle,
  UserPlus,
  Video,
  ArrowUpRight,
  Filter,
  Eye,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";
import { useDashboardStats, useRecentLearners } from "@/hooks/useAdmin";

interface DashboardStats {
  totalActiveLearners: number;
  totalDrills: number;
  newSignupsThisWeek?: number;
  discoveryCallsToday?: number;
  videosAwaitingReview?: number;
}

const Dashboard: React.FC = () => {
  // Use React Query instead of useEffect + useState
  const { data: stats = { totalActiveLearners: 0, totalDrills: 0 }, isLoading: statsLoading } = useDashboardStats();
  const { data: learners = [], isLoading: learnersLoading } = useRecentLearners(10);
  
  const loading = statsLoading || learnersLoading;

  const displayStats = [
    {
      title: "Total Active Learners",
      value: loading ? "..." : stats.totalActiveLearners.toString(),
      change: "",
      color: "border-emerald-200 bg-emerald-50/30",
    },
    {
      title: "Total Drills",
      value: loading ? "..." : stats.totalDrills.toString(),
      change: "",
      color: "border-purple-200 bg-purple-50/30",
    },
    {
      title: "Discovery Calls Today",
      value: loading ? "..." : (stats.discoveryCallsToday || 0).toString(),
      change: "",
      color: "border-blue-200 bg-blue-50/30",
    },
    {
      title: "Videos Awaiting Review",
      value: loading ? "..." : (stats.videosAwaitingReview || 0).toString(),
      change: "",
      color: "border-amber-200 bg-amber-50/30",
    },
  ];

  const discoveryCalls: any[] = []; // TODO: Implement discovery calls endpoint

  const activities: any[] = []; // TODO: Implement recent activities endpoint

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayStats.map(
          (
            stat: {
              title: string;
              value: string;
              change: string;
              color: string;
            },
            idx: number
          ) => (
            <div
              key={idx}
              className={`p-6 rounded-2xl border ${stat.color} relative overflow-hidden`}
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
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Discovery Calls */}
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
            {discoveryCalls.map((call, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {call.name}
                  </h3>
                  <p className="text-xs text-gray-500">{call.purpose}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <Clock className="w-3 h-3" />
                  {call.time}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Recent Activity
          </h2>
          <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
            {activities.map((activity, idx) => (
              <div key={idx} className="flex gap-4 relative">
                <div className={`z-10 p-2 rounded-lg ${activity.iconColor}`}>
                  <activity.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {activity.details}
                    </h3>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-4">
                      {activity.time}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activity.user} completed a task
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Learners Requiring Action */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="p-1.5 bg-amber-50 rounded-lg">
              <span className="text-amber-600 text-lg">!</span>
            </span>
            Learners Requiring Action
          </h2>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Learner
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : learners.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No learners found
                  </td>
                </tr>
              ) : (
                learners.slice(0, 4).map((learner, idx) => {
                  const name =
                    `${learner.firstName || ""} ${
                      learner.lastName || ""
                    }`.trim() || "Unknown";
                  const status =
                    learner.isActive === false ? "Inactive" : "Active";
                  const statusColor =
                    learner.isActive === false
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700";

                  return (
                    <tr
                      key={learner._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {learner.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium border border-transparent shadow-sm ${statusColor.replace(
                            "bg-",
                            "bg-opacity-50 "
                          )}`}
                        >
                          {status}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/learners/${learner._id}`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#418b43] hover:underline"
                        >
                          View Profile <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
