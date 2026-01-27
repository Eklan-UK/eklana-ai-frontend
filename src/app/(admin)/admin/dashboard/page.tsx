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
  CalendarDays,
  Target,
  Flame,
} from "lucide-react";
import Link from "next/link";
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";
import { useDashboardStats, useRecentLearners } from "@/hooks/useAdmin";
import { useOverallPronunciationAnalytics } from "@/hooks/usePronunciations";
import { BarChart, Mic, AlertCircle, Volume2 } from "lucide-react";

interface DashboardStats {
  totalActiveLearners: number;
  totalDrills: number;
  newSignupsThisWeek: number;
  discoveryCallsToday: number;
  videosAwaitingReview: number;
}

const Dashboard: React.FC = () => {
  // Use React Query instead of useEffect + useState
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: learners = [], isLoading: learnersLoading } = useRecentLearners(10);
  const { data: pronunciationAnalytics, isLoading: pronunciationLoading } = useOverallPronunciationAnalytics();

  const loading = statsLoading || learnersLoading || pronunciationLoading;

  // Default stats with all optional properties
  const statsWithDefaults: DashboardStats = stats
    ? {
        totalActiveLearners: stats.totalActiveLearners || 0,
        totalDrills: stats.totalDrills || 0,
        newSignupsThisWeek: stats.newSignupsThisWeek || 0,
        discoveryCallsToday: stats.discoveryCallsToday || 0,
        videosAwaitingReview: stats.videosAwaitingReview || 0,
      }
    : {
        totalActiveLearners: 0,
        totalDrills: 0,
        newSignupsThisWeek: 0,
        discoveryCallsToday: 0,
        videosAwaitingReview: 0,
      };

  const displayStats = [
    {
      title: "Total Active Learners",
      value: loading ? "..." : statsWithDefaults.totalActiveLearners.toString(),
      change: "",
      color: "border-emerald-200 bg-emerald-50/30",
    },
    {
      title: "Total Drills",
      value: loading ? "..." : statsWithDefaults.totalDrills.toString(),
      change: "",
      color: "border-purple-200 bg-purple-50/30",
    },
    {
      title: "Discovery Calls Today",
      value: loading ? "..." : statsWithDefaults.discoveryCallsToday.toString(),
      change: "",
      color: "border-blue-200 bg-blue-50/30",
    },
    {
      title: "Videos Awaiting Review",
      value: loading
        ? "..."
        : statsWithDefaults.videosAwaitingReview.toString(),
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
        <div className="flex items-center gap-3">
          <Link
            href="/admin/daily-focus/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm"
          >
            <CalendarDays className="w-4 h-4" />
            Daily Focus
          </Link>
          <Link
            href="/admin/drill"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Drill Builder
          </Link>
        </div>
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
            idx: number,
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
          ),
        )}
      </div>

      {/* Daily Focus Quick Access */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Daily Focus</h2>
              <p className="text-sm text-gray-500">
                Manage daily practice content for all learners
              </p>
            </div>
          </div>
          <Link
            href="/admin/daily-focus"
            className="text-sm font-medium text-orange-600 hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/daily-focus/create"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-orange-100 hover:border-orange-300 hover:shadow-sm transition-all group"
          >
            <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
              <Plus className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Create New</p>
              <p className="text-xs text-gray-500">Add daily focus</p>
            </div>
          </Link>
          <Link
            href="/admin/daily-focus"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-orange-100 hover:border-orange-300 hover:shadow-sm transition-all group"
          >
            <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
              <CalendarDays className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Schedule</p>
              <p className="text-xs text-gray-500">View all entries</p>
            </div>
          </Link>
          <Link
            href="/admin/daily-focus"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-orange-100 hover:border-orange-300 hover:shadow-sm transition-all group"
          >
            <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Analytics</p>
              <p className="text-xs text-gray-500">View completions</p>
            </div>
          </Link>
        </div>
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
                            "bg-opacity-50 ",
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

      {/* Pronunciation Analytics Overview */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="p-2 bg-blue-50 rounded-lg">
              <Mic className="w-4 h-4 text-blue-600" />
            </span>
            Pronunciation Analytics (Last 30 Days)
          </h2>
        </div>

        {pronunciationLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !pronunciationAnalytics ? (
          <div className="text-center py-8 text-gray-500">
            No pronunciation data available.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overall Stats */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Total Attempts</p>
                <p className="text-2xl font-bold text-gray-900">{pronunciationAnalytics.stats?.totalAttempts || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Average Score</p>
                <p className={`text-2xl font-bold ${
                  (pronunciationAnalytics.stats?.averageScore || 0) >= 70 ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {pronunciationAnalytics.stats?.averageScore || 0}%
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Pass Rate</p>
                <p className="text-2xl font-bold text-blue-600">{pronunciationAnalytics.stats?.passRate || 0}%</p>
              </div>
            </div>

            {/* Problem Areas - Letters */}
            <div className="bg-red-50/50 rounded-xl border border-red-100 p-4">
              <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Most Difficult Letters
              </h3>
              <div className="flex flex-wrap gap-2">
                {pronunciationAnalytics.problemAreas?.topIncorrectLetters?.length > 0 ? (
                  pronunciationAnalytics.problemAreas.topIncorrectLetters.map((item: any, i: number) => (
                    <div key={i} className="px-3 py-1.5 bg-white border border-red-100 rounded-lg shadow-sm flex items-center gap-2">
                      <span className="font-mono font-bold text-red-600">{item.letter}</span>
                      <span className="text-xs text-gray-500">×{item.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 italic">No data available</p>
                )}
              </div>
            </div>

            {/* Problem Areas - Phonemes */}
            <div className="bg-orange-50/50 rounded-xl border border-orange-100 p-4">
              <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Most Difficult Sounds
              </h3>
              <div className="flex flex-wrap gap-2">
                {pronunciationAnalytics.problemAreas?.topIncorrectPhonemes?.length > 0 ? (
                  pronunciationAnalytics.problemAreas.topIncorrectPhonemes.map((item: any, i: number) => (
                    <div key={i} className="px-3 py-1.5 bg-white border border-orange-100 rounded-lg shadow-sm flex items-center gap-2">
                      <span className="font-medium text-orange-600">{item.phoneme}</span>
                      <span className="text-xs text-gray-500">×{item.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 italic">No data available</p>
                )}
              </div>
            </div>

            {/* Difficult Words Table */}
            <div className="lg:col-span-1 rounded-xl border border-gray-200 overflow-hidden">
               <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                 <h3 className="text-sm font-bold text-gray-900">Most Difficult Words</h3>
               </div>
               <div className="max-h-[300px] overflow-y-auto">
                 {pronunciationAnalytics.difficultWords?.length > 0 ? (
                   <table className="w-full text-sm">
                     <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                       <tr>
                         <th className="px-4 py-2 text-left font-medium">Word</th>
                         <th className="px-4 py-2 text-right font-medium">Avg Score</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                       {pronunciationAnalytics.difficultWords.map((word: any, i: number) => (
                         <tr key={i} className="hover:bg-gray-50">
                           <td className="px-4 py-2 font-medium text-gray-900">{word.word}</td>
                           <td className="px-4 py-2 text-right">
                             <span className={`font-bold ${word.avgScore < 60 ? 'text-red-600' : 'text-amber-600'}`}>
                               {word.avgScore}%
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 ) : (
                   <div className="p-4 text-center text-xs text-gray-500 italic">No data available</div>
                 )}
               </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
