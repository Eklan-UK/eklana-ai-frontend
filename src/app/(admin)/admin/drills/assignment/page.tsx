"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  ArrowRight,
  Filter,
  Search,
  Loader2,
  Calendar,
  User,
} from "lucide-react";
import Link from "next/link";
import { useAllDrills } from "@/hooks/useAdmin";

interface Drill {
  _id: string;
  title: string;
  type: string;
  difficulty: string;
  date: string;
  duration_days: number;
  assigned_to: string[];
  created_by: string;
  is_active: boolean;
}

export default function DrillAssignmentPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");

  // Use React Query instead of useEffect + useState
  const { data: drills = [], isLoading: loading } = useAllDrills({ limit: 100 });

  const filteredDrills = React.useMemo(() => drills.filter((drill) => {
    const matchesSearch =
      drill.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drill.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || drill.type === filterType;
    const matchesDifficulty =
      filterDifficulty === "all" || drill.difficulty === filterDifficulty;
    return matchesSearch && matchesType && matchesDifficulty;
  }), [drills, searchTerm, filterType, filterDifficulty]);

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      vocabulary: "bg-blue-100 text-blue-700",
      roleplay: "bg-purple-100 text-purple-700",
      matching: "bg-green-100 text-green-700",
      definition: "bg-yellow-100 text-yellow-700",
      grammar: "bg-red-100 text-red-700",
      sentence_writing: "bg-indigo-100 text-indigo-700",
      summary: "bg-pink-100 text-pink-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Drill Assignment</h1>
          <p className="text-gray-500 text-sm">
            Assign drills to students by selecting a drill and choosing students
          </p>
        </div>
        <Link
          href="/admin/drills/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all"
        >
          <Plus className="w-4 h-4" />
          Create New Drill
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="vocabulary">Vocabulary</option>
            <option value="roleplay">Roleplay</option>
            <option value="matching">Matching</option>
            <option value="definition">Definition</option>
            <option value="grammar">Grammar</option>
            <option value="sentence_writing">Sentence Writing</option>
            <option value="summary">Summary</option>
          </select>
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
        </div>
      </div>

      {/* Drills List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50">
          <h2 className="flex items-center gap-3 text-lg font-bold text-gray-800">
            <BookOpen className="w-5 h-5 text-gray-400" />
            All Drills ({filteredDrills.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading drills...</p>
            </div>
          ) : filteredDrills.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No drills found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Title
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Type
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Difficulty
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Assigned To
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Date
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDrills.map((drill) => (
                  <tr
                    key={drill._id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {drill.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created by {drill.created_by}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold rounded-full ${getTypeColor(
                          drill.type
                        )}`}
                      >
                        {drill.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold rounded-full ${getDifficultyColor(
                          drill.difficulty
                        )}`}
                      >
                        {drill.difficulty}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {drill.assigned_to?.length || 0} student
                          {(drill.assigned_to?.length || 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(drill.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <Link
                        href={`/admin/drills/assignment/${drill._id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#418b43] text-white text-sm font-medium rounded-xl hover:bg-[#3a7c3b] transition-all"
                      >
                        Assign to Students
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
