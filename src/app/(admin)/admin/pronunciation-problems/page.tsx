"use client";

import React, { useState, useMemo } from "react";
import {
  Mic,
  Plus,
  ArrowRight,
  Search,
  Loader2,
  BookOpen,
  Clock,
  Edit,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { pronunciationProblemAPI } from "@/lib/api";
import { toast } from "sonner";

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
}

export default function PronunciationProblemsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");

  // Fetch pronunciation problems
  // For admin, don't pass isActive filter to get all problems (active and inactive)
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['pronunciation-problems', 'admin'],
    queryFn: async () => {
      // Don't pass isActive at all for admin - API will return all problems
      const response = await pronunciationProblemAPI.getAll();
      return response.data?.problems || [];
    },
  });

  const problems = data || [];

  const filteredProblems = useMemo(
    () =>
      problems.filter((problem: PronunciationProblem) => {
        const matchesSearch =
          problem.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          problem.description?.toLowerCase().includes(searchTerm.toLowerCase());
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
            Create pronunciation problems and add words to them
          </p>
        </div>
        <Link
          href="/admin/pronunciation-problems/create"
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
            <Mic className="w-5 h-5 text-gray-400" />
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
              <Mic className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">No pronunciation problems found</p>
              <Link
                href="/admin/pronunciation-problems/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#418b43] text-white text-sm font-medium rounded-xl hover:bg-[#3a7c3b] transition-all"
              >
                <Plus className="w-4 h-4" />
                Create Your First Problem
              </Link>
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
                    Difficulty
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Words
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">
                    Actions
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
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{problem.estimatedTimeMinutes} min</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm text-gray-700 max-w-md truncate">
                        {problem.description || "—"}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1">
                        {problem.phonemes?.slice(0, 3).map((phoneme: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                          >
                            /{phoneme}/
                          </span>
                        ))}
                        {problem.phonemes && problem.phonemes.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{problem.phonemes.length - 3}
                          </span>
                        )}
                      </div>
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
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {problem.wordCount || 0} word{problem.wordCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/pronunciation-problems/${problem.slug}/words`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#418b43] text-white text-sm font-medium rounded-xl hover:bg-[#3a7c3b] transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Add Words
                        </Link>
                        <Link
                          href={`/admin/pronunciation-problems/${problem.slug}`}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
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

