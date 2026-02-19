"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Calendar,
  Clock,
  Target,
  Loader2,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface DailyFocus {
  _id: string;
  title: string;
  focusType: string;
  practiceFormat: string;
  description?: string;
  date: string;
  estimatedMinutes: number;
  difficulty: string;
  isActive: boolean;
  totalCompletions: number;
  averageScore: number;
  createdAt: string;
  createdBy?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

const focusTypeColors: Record<string, string> = {
  grammar: "bg-primary-100 text-primary-700",
  vocabulary: "bg-blue-100 text-blue-700",
  matching: "bg-green-100 text-green-700",
  pronunciation: "bg-orange-100 text-orange-700",
  general: "bg-gray-100 text-gray-700",
};

const formatTypeColors: Record<string, string> = {
  "fill-in-blank": "bg-indigo-100 text-indigo-700",
  matching: "bg-emerald-100 text-emerald-700",
  "multiple-choice": "bg-cyan-100 text-cyan-700",
  vocabulary: "bg-amber-100 text-amber-700",
  mixed: "bg-rose-100 text-rose-700",
};

export default function DailyFocusPage() {
  const [dailyFocusEntries, setDailyFocusEntries] = useState<DailyFocus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchDailyFocus = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", ((page - 1) * limit).toString());
      if (filterType) params.append("focusType", filterType);
      if (filterActive) params.append("isActive", filterActive);

      const response = await fetch(`/api/v1/daily-focus?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch daily focus entries");
      }

      const data = await response.json();
      setDailyFocusEntries(data.dailyFocus || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      toast.error(error.message || "Failed to load daily focus entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyFocus();
  }, [page, filterType, filterActive]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this daily focus?")) return;

    try {
      const response = await fetch(`/api/v1/daily-focus/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete daily focus");
      }

      toast.success("Daily focus deleted successfully");
      fetchDailyFocus();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete daily focus");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const filteredEntries = dailyFocusEntries.filter((entry) =>
    entry.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Focus</h1>
          <p className="text-gray-500 text-sm">
            Manage daily practice content for learners
          </p>
        </div>
        <Link
          href="/admin/daily-focus/create"
          className="flex items-center gap-2 px-6 py-3 bg-[#418b43] text-white font-bold rounded-full hover:bg-[#3a7c3b] transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Create Daily Focus
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-8 py-3 bg-gray-50 border border-gray-100 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">All Types</option>
              <option value="grammar">Grammar</option>
              <option value="vocabulary">Vocabulary</option>
              <option value="matching">Matching</option>
              <option value="pronunciation">Pronunciation</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#418b43]" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            No Daily Focus Entries
          </h3>
          <p className="text-gray-500 mb-6">
            Create your first daily focus to provide daily practice content
          </p>
          <Link
            href="/admin/daily-focus/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#418b43] text-white font-bold rounded-full hover:bg-[#3a7c3b]"
          >
            <Plus className="w-5 h-5" />
            Create Daily Focus
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredEntries.map((entry) => (
            <div
              key={entry._id}
              className={`bg-white rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md ${isToday(entry.date)
                  ? "border-green-300 bg-green-50/30"
                  : "border-gray-100"
                }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {isToday(entry.date) && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                        TODAY
                      </span>
                    )}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${focusTypeColors[entry.focusType] || "bg-gray-100"
                        }`}
                    >
                      {entry.focusType}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${formatTypeColors[entry.practiceFormat] || "bg-gray-100"
                        }`}
                    >
                      {entry.practiceFormat.replace("-", " ")}
                    </span>
                    {entry.isActive ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <XCircle className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {entry.title}
                  </h3>

                  {entry.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {entry.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(entry.date)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{entry.estimatedMinutes} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      <span className="capitalize">{entry.difficulty}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-gray-500">
                      {entry.totalCompletions} completions
                    </span>
                    <span className="text-gray-500">
                      Avg. score: {entry.averageScore.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/daily-focus/${entry._id}`}
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    title="View/Edit"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </Link>
                  <button
                    onClick={() => handleDelete(entry._id)}
                    className="p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / limit)}
            className="px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

