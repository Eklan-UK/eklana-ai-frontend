"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Search, BookOpen, Loader2, Plus, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTutorDrills, useDeleteDrill, useDeleteDrills } from "@/hooks/useDrills";
import { useDrillSelection } from "@/hooks/useDrillSelection";
import { TutorDrillCard } from "@/components/drills/TutorDrillCard";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  appendReturnTo,
  buildDrillListPath,
  buildReturnToQueryParam,
  hasActiveDrillListFilters,
  parseDrillListFilters,
  type DrillListFilters,
} from "@/lib/drill-list-filters";

interface DrillsListClientProps {
  initialDrills: any[];
}

const TUTOR_DRILL_LIST_PATH = "/tutor/drills/all";

function DrillsListClientContent({ initialDrills }: DrillsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseDrillListFilters(searchParams), [searchParams]);

  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  const updateFilters = useCallback(
    (partial: Partial<DrillListFilters>) => {
      const next = { ...filters, ...partial };
      router.replace(buildDrillListPath(TUTOR_DRILL_LIST_PATH, next), { scroll: false });
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

  const returnToParam = buildReturnToQueryParam(filters, TUTOR_DRILL_LIST_PATH);
  const filtersActive = hasActiveDrillListFilters(filters);

  const apiFilters =
    filters.status === "all"
      ? {}
      : { assignmentStatus: filters.status as "saved" | "assigned" };

  const { data: drills = initialDrills, isLoading: loading } = useTutorDrills(apiFilters);
  const deleteMutation = useDeleteDrill();
  const bulkDeleteMutation = useDeleteDrills();

  const filteredDrills = drills.filter((drill) => {
    const query = filters.q.trim().toLowerCase();
    if (!query) return true;
    return (
      drill.title?.toLowerCase().includes(query) ||
      drill.type?.toLowerCase().includes(query) ||
      drill.difficulty?.toLowerCase().includes(query)
    );
  });

  const selectionResetKey = `${filters.q}|${filters.status}`;
  const visibleDrillIds = useMemo(
    () =>
      filteredDrills
        .map((d) => (d._id || d.id)?.toString())
        .filter(Boolean) as string[],
    [filteredDrills]
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
      filteredDrills
        .filter((d) => selectedIdList.includes((d._id || d.id)?.toString() ?? ""))
        .map((d) => d.title as string),
    [filteredDrills, selectedIdList]
  );

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
    router.replace(TUTOR_DRILL_LIST_PATH, { scroll: false });
  };

  return (
    <>
      <div className="mb-6">
        <Link href={appendReturnTo("/tutor/drills/create", returnToParam)}>
          <Button variant="primary" size="lg" fullWidth>
            <Plus className="w-5 h-5 mr-2" />
            Create New Drill
          </Button>
        </Link>
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search drills..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filters.status === "all" ? "primary" : "outline"}
            size="sm"
            onClick={() => updateFilters({ status: "all", offset: 0 })}
          >
            All
          </Button>
          <Button
            variant={filters.status === "saved" ? "primary" : "outline"}
            size="sm"
            onClick={() => updateFilters({ status: "saved", offset: 0 })}
          >
            Saved
          </Button>
          <Button
            variant={filters.status === "assigned" ? "primary" : "outline"}
            size="sm"
            onClick={() => updateFilters({ status: "assigned", offset: 0 })}
          >
            Assigned
          </Button>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {someSelected && filteredDrills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <Checkbox
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all drills on this page"
            className="rounded border-gray-300"
          />
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

      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading drills...</p>
          </Card>
        ) : filteredDrills.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No drills found
            </h3>
            <p className="text-gray-600 mb-4">
              {filters.q.trim()
                ? "No drills match your search"
                : filters.status === "all"
                ? "Create your first drill to get started"
                : `No ${filters.status} drills found`}
            </p>
            {filters.status === "all" && !filters.q.trim() && (
              <Link href={appendReturnTo("/tutor/drills/create", returnToParam)}>
                <Button variant="primary">Create Drill</Button>
              </Link>
            )}
          </Card>
        ) : (
          filteredDrills.map((drill) => {
            const drillId = (drill._id || drill.id)?.toString() ?? "";
            return (
              <TutorDrillCard
                key={drillId}
                drill={drill}
                returnToParam={returnToParam}
                selectable
                checked={isSelected(drillId)}
                onCheckedChange={() => toggle(drillId)}
                onDelete={(id) => {
                  if (
                    confirm(
                      "Are you sure you want to delete this drill? This action cannot be undone."
                    )
                  ) {
                    deleteMutation.mutate(id);
                  }
                }}
                isDeleting={deleteMutation.isPending}
              />
            );
          })
        )}
      </div>

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
            <div className="flex gap-3 mt-6">
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
    </>
  );
}

export function DrillsListClient({ initialDrills }: DrillsListClientProps) {
  return (
    <Suspense
      fallback={
        <Card className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading drills...</p>
        </Card>
      }
    >
      <DrillsListClientContent initialDrills={initialDrills} />
    </Suspense>
  );
}
