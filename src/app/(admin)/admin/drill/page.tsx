"use client";

import React, { Suspense, useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Search,
  Loader2,
  Eye,
  Calendar,
  X,
  FileCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useAllDrills, useAllLearners } from "@/hooks/useAdmin";
import { useDeleteDrill, useDeleteDrills } from "@/hooks/useDrills";
import { useDrillSelection } from "@/hooks/useDrillSelection";
import { Checkbox } from "@/components/ui/Checkbox";
import { AssignedStudentsModal } from "@/components/drills/AssignedStudentsModal";
import { AdminDrillBookmarkButton } from "@/components/admin/AdminDrillBookmarkButton";
import { useRouter, useSearchParams } from "next/navigation";
import {
  appendReturnTo,
  buildDrillListPath,
  buildReturnToQueryParam,
  hasActiveDrillListFilters,
  parseDrillListFilters,
  type DrillAssignmentStatus,
  type DrillListFilters,
} from "@/lib/drill-list-filters";

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
  is_bookmarked?: boolean;
}

const PAGE_SIZE = 50;
const ADMIN_DRILL_LIST_PATH = "/admin/drill";

function AdminDrillPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseDrillListFilters(searchParams), [searchParams]);

  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [studentDraft, setStudentDraft] = useState(filters.student);
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [viewStudentsDrill, setViewStudentsDrill] = useState<Drill | null>(null);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    setStudentDraft(filters.student);
  }, [filters.student]);

  const updateFilters = useCallback(
    (partial: Partial<DrillListFilters>) => {
      const next = { ...filters, ...partial };
      router.replace(buildDrillListPath(ADMIN_DRILL_LIST_PATH, next), { scroll: false });
    },
    [filters, router]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDraft !== filters.q) {
        updateFilters({ q: searchDraft, offset: 0 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft, filters.q, updateFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (studentDraft !== filters.student) {
        updateFilters({ student: studentDraft, offset: 0 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentDraft, filters.student, updateFilters]);

  const returnToParam = buildReturnToQueryParam(filters, ADMIN_DRILL_LIST_PATH);
  const filtersActive = hasActiveDrillListFilters(filters);

  const studentSearch = filters.student.trim();

  const {
    data: matchingLearnersData,
    isLoading: learnersLoading,
    isFetching: learnersFetching,
  } = useAllLearners(
    studentSearch ? { search: studentSearch, limit: 200 } : undefined,
    { enabled: studentSearch.length > 0 }
  );

  const resolvedStudentIds = useMemo(() => {
    if (!studentSearch) return undefined;
    if (learnersLoading || learnersFetching) return null;
    return (matchingLearnersData?.learners ?? [])
      .map((l: { _id?: string; id?: string }) => (l._id ?? l.id)?.toString())
      .filter(Boolean) as string[];
  }, [matchingLearnersData, studentSearch, learnersLoading, learnersFetching]);

  const drillsEnabled =
    resolvedStudentIds === undefined ||
    (resolvedStudentIds !== null && resolvedStudentIds.length > 0);

  const drillQueryFilters = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: filters.offset,
      q: filters.q.trim() || undefined,
      type: filters.type !== "all" ? filters.type : undefined,
      assignmentStatus:
        filters.status === "saved" || filters.status === "assigned"
          ? filters.status
          : undefined,
      assignedToIds:
        resolvedStudentIds && resolvedStudentIds.length > 0
          ? resolvedStudentIds
          : undefined,
      // Precision Clinic drills are managed on their own admin surface.
      excludeSource: "precision_clinic" as const,
    }),
    [filters.offset, filters.q, filters.type, filters.status, resolvedStudentIds]
  );

  const { data, isLoading: loading } = useAllDrills(drillQueryFilters, {
    enabled: drillsEnabled,
  });
  const drills = data?.drills ?? [];
  const total = data?.total ?? 0;

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

  const displayDrills =
    Array.isArray(resolvedStudentIds) && resolvedStudentIds.length === 0
      ? []
      : drills;

  const selectionResetKey = `${filters.offset}|${filters.q}|${filters.type}|${filters.status}|${filters.student}`;
  const visibleDrillIds = useMemo(
    () => displayDrills.map((d) => d._id),
    [displayDrills]
  );
  const {
    selectedIdList,
    selectedCount,
    allSelected,
    someSelected,
    canBulkDelete,
    isSelected,
    toggle,
    toggleAll,
    clear: clearSelection,
  } = useDrillSelection(visibleDrillIds, selectionResetKey);

  const selectedDrillTitles = useMemo(
    () =>
      displayDrills
        .filter((d) => selectedIdList.includes(d._id))
        .map((d) => d.title),
    [displayDrills, selectedIdList]
  );

  const deleteMutation = useDeleteDrill();
  const bulkDeleteMutation = useDeleteDrills();

  const handleDelete = (drillId: string) => {
    deleteMutation.mutate(drillId, {
      onSuccess: () => {
        setShowDeleteModal(false);
        setSelectedDrill(null);
      },
    });
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedIdList, {
      onSuccess: ({ deletedCount }) => {
        if (deletedCount > 0) {
          setShowBulkDeleteModal(false);
          clearSelection();
        }
      },
    });
  };

  const clearFilters = () => {
    router.replace(ADMIN_DRILL_LIST_PATH, { scroll: false });
  };

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
            href={appendReturnTo("/admin/drills/create", returnToParam)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#418b43] text-white font-medium rounded-xl hover:bg-[#3a7c3b] transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create New Drill
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drills..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Users className="pointer-events-none absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by assigned student..."
              value={studentDraft}
              onChange={(e) => setStudentDraft(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
            />
            {studentSearch && (learnersLoading || learnersFetching) && (
              <Loader2 className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            )}
          </div>

          <select
            value={filters.type}
            onChange={(e) => updateFilters({ type: e.target.value, offset: 0 })}
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

          <select
            value={filters.status}
            onChange={(e) =>
              updateFilters({
                status: e.target.value as DrillAssignmentStatus,
                offset: 0,
              })
            }
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#418b43] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="saved">Saved</option>
            <option value="assigned">Assigned</option>
          </select>
        </div>

        {filtersActive && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {someSelected && (
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-6 py-3">
            <span className="text-sm text-gray-600">
              {selectedCount} drill{selectedCount !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              disabled={!canBulkDelete || bulkDeleteMutation.isPending}
              title={
                canBulkDelete
                  ? undefined
                  : "Deselect at least one drill to delete the rest."
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete selected ({selectedCount})
            </button>
            {!canBulkDelete && (
              <span className="text-xs text-gray-500">
                Deselect at least one drill to delete the rest.
              </span>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-4 py-4 w-12">
                  <Checkbox
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all drills on this page"
                    className="rounded border-gray-300"
                  />
                </th>
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
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : displayDrills.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    {studentSearch &&
                    !learnersLoading &&
                    !learnersFetching &&
                    (matchingLearnersData?.learners ?? []).length === 0
                      ? `No student found matching "${studentSearch}"`
                      : "No drills found"}
                  </td>
                </tr>
              ) : (
                displayDrills.map((drill) => (
                  <tr
                    key={drill._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <Checkbox
                        checked={isSelected(drill._id)}
                        onChange={() => toggle(drill._id)}
                        aria-label={`Select ${drill.title}`}
                        className="rounded border-gray-300"
                      />
                    </td>
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
                        <AdminDrillBookmarkButton
                          drillId={drill._id}
                          isBookmarked={Boolean(drill.is_bookmarked)}
                        />
                        <button
                          onClick={() => setViewStudentsDrill(drill)}
                          className="p-2 text-gray-600 hover:text-[#418b43] hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View assigned students"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Link
                          href={appendReturnTo(
                            `/admin/drills/create?drillId=${drill._id}`,
                            returnToParam
                          )}
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

        {total > 0 && (
          <div className="mt-6 flex items-center justify-between px-2">
            <p className="text-sm text-gray-500">
              Showing {filters.offset + 1}–{Math.min(filters.offset + PAGE_SIZE, total)} of {total} drills
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  updateFilters({
                    offset: Math.max(0, filters.offset - PAGE_SIZE),
                  })
                }
                disabled={filters.offset === 0 || loading}
                className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() =>
                  updateFilters({ offset: filters.offset + PAGE_SIZE })
                }
                disabled={filters.offset + PAGE_SIZE >= total || loading}
                className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {viewStudentsDrill && (
        <AssignedStudentsModal
          drillId={viewStudentsDrill._id}
          drillTitle={viewStudentsDrill.title}
          onClose={() => setViewStudentsDrill(null)}
        />
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete Selected Drills
            </h3>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete {selectedCount} drill
              {selectedCount !== 1 ? "s" : ""}? This action cannot be undone.
            </p>
            {selectedDrillTitles.length > 0 && (
              <ul className="text-sm text-gray-500 mb-6 max-h-32 overflow-y-auto list-disc list-inside">
                {selectedDrillTitles.slice(0, 5).map((title, index) => (
                  <li key={`${title}-${index}`} className="truncate">
                    {title}
                  </li>
                ))}
                {selectedDrillTitles.length > 5 && (
                  <li>and {selectedDrillTitles.length - 5} more...</li>
                )}
              </ul>
            )}
            <div className={`flex gap-3${selectedDrillTitles.length === 0 ? " mt-6" : ""}`}>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
}

const AdminDrillPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <AdminDrillPageContent />
    </Suspense>
  );
};

export default AdminDrillPage;
