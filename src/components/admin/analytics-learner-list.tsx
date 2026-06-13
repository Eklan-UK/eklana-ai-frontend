"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Eye,
  Loader2,
  X,
  Search,
} from "lucide-react";
import { useAnalyticsLearners } from "@/hooks/useAdmin";

type SignupStatusFilter = "" | "active" | "inactive";

export function AnalyticsLearnerList() {
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [signupDateFrom, setSignupDateFrom] = useState("");
  const [signupDateTo, setSignupDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<SignupStatusFilter>("");

  const learnerFilters = useMemo(
    () => ({
      limit,
      offset,
      search: searchQuery.trim() || undefined,
      signupDateFrom: signupDateFrom || undefined,
      signupDateTo: signupDateTo || undefined,
      status: statusFilter || undefined,
    }),
    [limit, offset, searchQuery, signupDateFrom, signupDateTo, statusFilter]
  );

  const hasActiveFilters = Boolean(signupDateFrom || signupDateTo || statusFilter);

  useEffect(() => {
    setOffset(0);
  }, [searchQuery, signupDateFrom, signupDateTo, statusFilter]);

  const { data, isLoading: loading } = useAnalyticsLearners(learnerFilters);
  const learners = data?.learners || [];
  const total = data?.total || 0;

  const clearFilters = () => {
    setSignupDateFrom("");
    setSignupDateTo("");
    setStatusFilter("");
  };

  const getLearnerName = (learner: {
    firstName?: string;
    lastName?: string;
    name?: string;
    email: string;
  }) => {
    const fromParts = `${learner.firstName || ""} ${learner.lastName || ""}`.trim();
    return fromParts || learner.name || learner.email;
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-600" />
            Learner Analytics
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Browse learners and view individual performance details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search learners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm w-full md:w-64"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition ${
              showFilters || hasActiveFilters
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Filter learners</h3>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-600"
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="analytics-signup-from" className="mb-1 block text-xs font-medium text-gray-500">
                Signup date from
              </label>
              <input
                id="analytics-signup-from"
                type="date"
                value={signupDateFrom}
                onChange={(e) => setSignupDateFrom(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="analytics-signup-to" className="mb-1 block text-xs font-medium text-gray-500">
                Signup date to
              </label>
              <input
                id="analytics-signup-to"
                type="date"
                value={signupDateTo}
                onChange={(e) => setSignupDateTo(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="analytics-status" className="mb-1 block text-xs font-medium text-gray-500">
                Status
              </label>
              <select
                id="analytics-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SignupStatusFilter)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Learner</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Overall Progress</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Drill Completion</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Avg Drill Score</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Pronunciation</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : learners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No learners found
                </td>
              </tr>
            ) : (
              learners.map((learner) => {
                const name = getLearnerName(learner);
                const summary = learner.summary;
                return (
                  <tr key={learner._id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">{learner.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold text-emerald-700">
                        {summary.overallProgressPct}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {summary.drillCompletionRatePct}%
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {summary.drillAverageScore > 0 ? `${summary.drillAverageScore}%` : "—"}
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {summary.pronunciationAverageScore > 0
                        ? `${summary.pronunciationAverageScore}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/analytics/${learner._id}`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#418b43] hover:underline"
                        >
                          View analytics <BarChart2 className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/admin/learners/${learner._id}`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          Profile <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > limit ? (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Page {currentPage} of {totalPages} ({total} learners)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
