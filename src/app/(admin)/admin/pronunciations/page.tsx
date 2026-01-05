"use client";

import React, { useState, useMemo } from "react";
import {
  Mic,
  Plus,
  ArrowRight,
  Search,
  Loader2,
  Calendar,
  User,
  Volume2,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { usePronunciationProblems } from "@/hooks/usePronunciations";

interface PronunciationProblem {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  phonemes: string[];
  difficulty: string;
  estimatedTimeMinutes?: number;
  wordCount?: number;
  createdBy: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function PronunciationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");

  // Use React Query
  const { data, isLoading: loading } = usePronunciationProblems({
    isActive: filterActive === "all" ? undefined : filterActive === "active",
  });
  const problems = data?.problems || [];

  const filteredProblems = useMemo(
    () =>
      problems.filter((problem: PronunciationProblem) => {
        const matchesSearch =
          problem.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (problem.description && problem.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesDifficulty =
          filterDifficulty === "all" || problem.difficulty === filterDifficulty;
        const matchesActive =
          filterActive === "all" ||
          (filterActive === "active" && problem.isActive) ||
          (filterActive === "inactive" && !problem.isActive);

        return matchesSearch && matchesDifficulty && matchesActive;
      }),
    [problems, searchTerm, filterDifficulty, filterActive]
  );

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-8 pb-12 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pronunciation Problems</h1>
          <p className="text-gray-500 text-sm">
            Create and manage pronunciation problems and their words
          </p>
        </div>
        <Link
          href="/admin/pronunciations/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Problem
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search problems..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
          </div>
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Problems List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50">
          <h2 className="flex items-center gap-3 text-lg font-bold text-gray-800">
            <BookOpen className="w-5 h-5 text-gray-400" />
            All Problems ({filteredProblems.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading problems...</p>
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No problems found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Title
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Description
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Phonemes
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Words
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Difficulty
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProblems.map((problem: PronunciationProblem) => (
                  <tr
                    key={problem._id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {problem.title}
                        </p>
                        {problem.estimatedTimeMinutes && (
                          <p className="text-xs text-gray-500 mt-1">
                            ~{problem.estimatedTimeMinutes} min
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm text-gray-700 max-w-md truncate">
                        {problem.description || "No description"}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1">
                        {problem.phonemes.map((phoneme, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded"
                          >
                            {phoneme}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm text-gray-700 font-medium">
                        {problem.wordCount || 0} words
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold rounded-full ${getDifficultyColor(
                          problem.difficulty
                        )}`}
                      >
                        {problem.difficulty}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <Link
                        href={`/admin/pronunciations/${problem.slug}/words`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#418b43] text-white text-sm font-medium rounded-xl hover:bg-[#3a7c3b] transition-all"
                      >
                        Manage Words
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

