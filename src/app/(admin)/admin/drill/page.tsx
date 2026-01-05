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
  context?: string;
}

const AdminDrillPage: React.FC = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    type: "",
    difficulty: "",
    date: "",
    duration_days: 1,
    context: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // Use React Query instead of useEffect + useState
  const { data: drills = [], isLoading: loading } = useAllDrills({
    limit: 100,
  });
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

  const handleEditClick = (drill: Drill) => {
    setSelectedDrill(drill);
    setEditFormData({
      title: drill.title,
      type: drill.type,
      difficulty: drill.difficulty,
      date: new Date(drill.date).toISOString().split("T")[0],
      duration_days: drill.duration_days || 1,
      context: drill.context || "",
      is_active: drill.is_active,
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!selectedDrill) return;

    try {
      setSaving(true);
      await drillAPI.update(selectedDrill._id, {
        title: editFormData.title,
        type: editFormData.type,
        difficulty: editFormData.difficulty,
        date: new Date(editFormData.date).toISOString(),
        duration_days: editFormData.duration_days,
        context: editFormData.context,
        is_active: editFormData.is_active,
      });
      toast.success("Drill updated successfully");
      setShowEditModal(false);
      setSelectedDrill(null);
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: queryKeys.drills.all });
    } catch (error: any) {
      toast.error("Failed to update drill: " + error.message);
    } finally {
      setSaving(false);
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

  const filteredDrills = React.useMemo(
    () =>
      drills.filter((drill) => {
        const matchesSearch =
          drill.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          drill.context?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === "all" || drill.type === filterType;
        const matchesDifficulty =
          filterDifficulty === "all" || drill.difficulty === filterDifficulty;
        const matchesActive =
          filterActive === "all" ||
          (filterActive === "active" && drill.is_active) ||
          (filterActive === "inactive" && !drill.is_active);

        return (
          matchesSearch && matchesType && matchesDifficulty && matchesActive
        );
      }),
    [drills, searchTerm, filterType, filterDifficulty, filterActive]
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drill Management</h1>
          <p className="text-gray-500 text-sm">
            Manage all drills, assign to students, edit, and delete
          </p>
        </div>
        <Link
          href="/admin/drills/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create New Drill
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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

          {/* Active Filter */}
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                        {drill.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {drill.assigned_to?.length || 0} student
                          {drill.assigned_to?.length !== 1 ? "s" : ""}
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
                          drill.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {drill.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/tutor/drills/${drill._id}`}
                          className="p-2 text-gray-600 hover:text-[#418b43] hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleEditClick(drill)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDrill(drill);
                            setShowAssignModal(true);
                          }}
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Assign to Students"
                        >
                          <Users className="w-4 h-4" />
                        </button>
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

      {/* Assign Modal */}
      {showAssignModal && selectedDrill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Assign Drill to Students
            </h3>
            <p className="text-gray-600 mb-4">
              Assign &quot;{selectedDrill.title}&quot; to students
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDrill(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <Link
                href={`/admin/drills/assignment?drillId=${selectedDrill._id}`}
                className="flex-1 px-4 py-2 bg-[#418b43] text-white rounded-lg hover:bg-[#3a7c3b] transition-colors text-center"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDrill(null);
                }}
              >
                Go to Assignment
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedDrill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Drill</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedDrill(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, title: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  value={editFormData.type}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, type: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
                  required
                >
                  <option value="vocabulary">Vocabulary</option>
                  <option value="roleplay">Roleplay</option>
                  <option value="matching">Matching</option>
                  <option value="definition">Definition</option>
                  <option value="summary">Summary</option>
                  <option value="grammar">Grammar</option>
                  <option value="sentence_writing">Sentence Writing</option>
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty *
                </label>
                <select
                  value={editFormData.difficulty}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      difficulty: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
                  required
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              {/* Date and Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={editFormData.date}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editFormData.duration_days}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        duration_days: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Context
                </label>
                <textarea
                  value={editFormData.context}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      context: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
                  placeholder="Optional context or instructions..."
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editFormData.is_active}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      is_active: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[#418b43] border-gray-300 rounded focus:ring-[#418b43]"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium text-gray-700"
                >
                  Active
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedDrill(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={
                  saving ||
                  !editFormData.title ||
                  !editFormData.type ||
                  !editFormData.difficulty
                }
                className="flex-1 px-4 py-2 bg-[#418b43] text-white rounded-lg hover:bg-[#3a7c3b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDrillPage;
