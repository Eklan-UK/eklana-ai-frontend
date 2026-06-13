"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Search,
  Filter,
  Loader2,
  Eye,
  Calendar,
  Target,
  BookOpen,
  X,
  FileCheck,
} from "lucide-react";
import Link from "next/link";
import { useAllDrills } from "@/hooks/useAdmin";
import { useDeleteDrill } from "@/hooks/useDrills";
import { drillAPI } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query";

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
  totalAssignments?: number;
  context?: string;
}

const AdminDrillPage: React.FC = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<string>("all");
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const drillQueryFilters = useMemo(
    () => ({
      limit: 100,
      type: filterType !== "all" ? filterType : undefined,
      difficulty: filterDifficulty !== "all" ? filterDifficulty : undefined,
      assignmentStatus:
        filterAssignmentStatus === "saved" || filterAssignmentStatus === "assigned"
          ? (filterAssignmentStatus as "saved" | "assigned")
          : undefined,
    }),
    [filterType, filterDifficulty, filterAssignmentStatus]
  );

  const { data: drills = [], isLoading: loading } = useAllDrills(drillQueryFilters);
  const deleteMutation = useDeleteDrill();
  const queryClient = useQueryClient();

  const handleDelete = async (drillId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this drill? This action cannot be undone."
      )
    ) {
      deleteMutation.mutate(drillId, {
        onSuccess: () => {
          setShowDeleteModal(false);
          setSelectedDrill(null);
        },
      });
    }
  };


  const getDrillIcon = (type: string): string => {
    const icons: Record<string, string> = {
      vocabulary: "📚",
      roleplay: "💬",
      matching: "🔗",
      definition: "📖",
      summary: "📝",
      grammar: "✏️",
      sentence_writing: "✍️",
      sentence: "✍️",
      listening: "🎧",
    };
    return icons[type] || "📚";
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredDrills = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return drills;

    return drills.filter((drill) => {
      const title = drill.title?.toLowerCase() ?? "";
      const type = drill.type?.toLowerCase() ?? "";
      const difficulty = drill.difficulty?.toLowerCase() ?? "";
      const context = drill.context?.toLowerCase() ?? "";

      return (
        title.includes(query) ||
        type.includes(query) ||
        difficulty.includes(query) ||
        context.includes(query)
      );
    });
  }, [drills, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          Manage all drills, assign to students, edit, and delete
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/drills/sentence-reviews"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-sm"
          >
            <FileCheck className="w-4 h-4" />
            Review Sentences
          </Link>
          <Link
            href="/admin/drills/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create New Drill
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="vocabulary">Vocabulary</option>
            <option value="roleplay">Roleplay</option>
            <option value="matching">Matching</option>
            <option value="definition">Definition</option>
            <option value="summary">Summary</option>
            <option value="grammar">Grammar</option>
            <option value="sentence_writing">Sentence Writing</option>
            <option value="sentence">Sentence</option>
            <option value="listening">Listening</option>
            <option value="pronunciation">Pronunciation</option>
            <option value="fill_blank">Fill in the Blank</option>
            <option value="key_phrases">Key Phrases</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {/* Assignment Status Filter */}
          <select
            value={filterAssignmentStatus}
            onChange={(e) => setFilterAssignmentStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="saved">Saved</option>
            <option value="assigned">Assigned</option>
          </select>
        </div>
      </div>

      {/* Drills Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Drill
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Difficulty
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : filteredDrills.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No drills found
                  </td>
                </tr>
              ) : (
                filteredDrills.map((drill) => (
                  <tr
                    key={drill._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {getDrillIcon(drill.type)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {drill.title}
                          </p>
                          {drill.context && (
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {drill.context}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                        {drill.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 capitalize">
                        {drill.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {(drill.totalAssignments ?? 0) === 0
                            ? "Not assigned"
                            : `${drill.totalAssignments} student${
                                drill.totalAssignments !== 1 ? "s" : ""
                              }`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(drill.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          (drill.totalAssignments ?? 0) > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {(drill.totalAssignments ?? 0) > 0 ? "Assigned" : "Saved"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/drills/${drill._id}`}
                          className="p-2 text-gray-600 hover:text-[#418b43] hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/admin/drills/create?drillId=${drill._id}`}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedDrill(drill);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedDrill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete Drill
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &quot;{selectedDrill.title}&quot;?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedDrill(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(selectedDrill._id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDrillPage;
