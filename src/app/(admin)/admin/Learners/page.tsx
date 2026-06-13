"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Download, ChevronLeft, ChevronRight, Eye, Loader2, X } from 'lucide-react';
import { useAllLearners } from '@/hooks/useAdmin';
import { adminAPI } from '@/lib/api';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  formatZeroPauseProductWithDate,
  type ZeroPauseProduct,
} from '@/domain/subscriptions/subscription.types';

type SignupStatusFilter = '' | 'active' | 'inactive';

function escapeCsvField(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const Learners: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [signupDateFrom, setSignupDateFrom] = useState('');
  const [signupDateTo, setSignupDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<SignupStatusFilter>('');
  const [exporting, setExporting] = useState(false);

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

  const hasActiveFilters = Boolean(
    signupDateFrom || signupDateTo || statusFilter
  );

  useEffect(() => {
    setOffset(0);
  }, [searchQuery, signupDateFrom, signupDateTo, statusFilter]);

  const { data, isLoading: loading } = useAllLearners(learnerFilters);

  const learners = data?.learners || [];
  const total = data?.total || 0;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const clearFilters = () => {
    setSignupDateFrom('');
    setSignupDateTo('');
    setStatusFilter('');
  };

  const handleExport = async () => {
    try {
      setExporting(true);

      const allLearners: Array<Record<string, unknown>> = [];
      let fetchOffset = 0;
      const fetchLimit = 500;

      while (true) {
        const response = await adminAPI.getAllLearners({
          limit: fetchLimit,
          offset: fetchOffset,
          search: searchQuery.trim() || undefined,
          signupDateFrom: signupDateFrom || undefined,
          signupDateTo: signupDateTo || undefined,
          status: statusFilter || undefined,
        });
        const batch = response.data?.learners || [];
        allLearners.push(...batch);

        const pagination = response.data?.pagination;
        if (!pagination?.hasMore || batch.length === 0) break;
        fetchOffset += fetchLimit;
      }

      const filtered = allLearners;

      if (filtered.length === 0) {
        toast.error('No learners to export');
        return;
      }

      const headers = [
        'Learner',
        'Email',
        'Learning Purpose',
        'Signup Date',
        'Signup Status',
        'Day-1 Video',
        'Drills',
      ];

      const rows = filtered.map((l) => {
        const name = `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Unknown';
        const status = l.isActive === false ? 'Inactive' : 'Active';
        return [
          name,
          String(l.email || ''),
          '-',
          formatDate(String(l.createdAt || '')),
          status,
          '-',
          String(l.drillCount || 0),
        ];
      });

      const csv = [
        headers.map(escapeCsvField).join(','),
        ...rows.map((row) => row.map(escapeCsvField).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `learners-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast.success(`Exported ${filtered.length} learner${filtered.length === 1 ? '' : 's'}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to export learners';
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learners</h1>
        <p className="text-gray-500 text-sm">Manage all learners and their progress</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full md:w-80">
            <input
              id="learner-name-search"
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border rounded-xl transition-colors ${
                showFilters || hasActiveFilters
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" /> Filters
              {hasActiveFilters ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                  !
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Filter learners</h2>
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
                <label htmlFor="signup-date-from" className="mb-1 block text-xs font-medium text-gray-500">
                  Signup date from
                </label>
                <input
                  id="signup-date-from"
                  type="date"
                  value={signupDateFrom}
                  onChange={(e) => setSignupDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="signup-date-to" className="mb-1 block text-xs font-medium text-gray-500">
                  Signup date to
                </label>
                <input
                  id="signup-date-to"
                  type="date"
                  value={signupDateTo}
                  onChange={(e) => setSignupDateTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="signup-status-filter" className="mb-1 block text-xs font-medium text-gray-500">
                  Signup status
                </label>
                <select
                  id="signup-status-filter"
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
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Learning Purpose</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Mode</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Signup Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-center">Signup Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-center">Day-1 Video</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-center">Drills</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : learners.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No learners found
                  </td>
                </tr>
              ) : (
                learners.map((l) => {
                  const name = `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown";
                  const status = l.isActive === false ? 'Inactive' : 'Active';
                  const zeroPause: ZeroPauseProduct[] = Array.isArray(l.zeroPauseProducts)
                    ? l.zeroPauseProducts
                    : [];
                  return (
                    <tr key={l._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">{name}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">{l.email}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">-</td>
                      <td className="px-4 py-4">
                        {zeroPause.length === 0 ? (
                          <span className="text-sm text-gray-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {zeroPause.map((product) => (
                              <span
                                key={product}
                                className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700"
                              >
                                {formatZeroPauseProductWithDate(product, l.zeroPauseDate)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                            status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                          }`}>{status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                            -
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                            {l.drillCount || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/learners/${l._id}`}
                          className="text-emerald-600 hover:text-emerald-700 font-bold text-xs inline-flex items-center gap-1"
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

        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} learners
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0 || loading}
              className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total || loading}
              className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Learners;
