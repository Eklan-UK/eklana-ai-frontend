"use client";

import React, { useState } from 'react';
import { Filter, Download, ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';
import { useAllLearners } from '@/hooks/useAdmin';
import Link from 'next/link';

const Learners: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');

  // Use React Query instead of useEffect + useState
  const { data, isLoading: loading } = useAllLearners({
    limit,
    offset,
    role: 'user',
    search: searchQuery || undefined,
  });

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
              type="text" 
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
              <Filter className="w-4 h-4" /> Filters
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Learner</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Learning Purpose</th>
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
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : learners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No learners found
                  </td>
                </tr>
              ) : (
                learners.map((l) => {
                  const name = `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown";
                  const status = l.isActive === false ? 'Inactive' : 'Active';
                  return (
                    <tr key={l._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">{name}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">{l.email}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">-</td>
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
