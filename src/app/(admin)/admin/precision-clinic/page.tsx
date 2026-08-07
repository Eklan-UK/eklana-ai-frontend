"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Target,
} from "lucide-react";
import {
  useArchivePrecisionClinic,
  useDeletePrecisionClinic,
  useDuplicatePrecisionClinic,
  usePrecisionClinicList,
} from "@/hooks/usePrecisionClinic";
import { ClinicStatCards, type ClinicStatCardData } from "@/components/precision-clinic/ClinicStatCards";
import { ClinicFiltersBar, type ClinicListFilters } from "@/components/precision-clinic/ClinicFiltersBar";
import {
  ClinicDifficultyBadge,
  ClinicStatusBadge,
  ClinicTypeBadge,
} from "@/components/precision-clinic/ClinicBadges";
import {
  ClinicRowActionsMenu,
  type ClinicRowAction,
} from "@/components/precision-clinic/ClinicRowActionsMenu";
import { ClinicAssignModal } from "@/components/precision-clinic/ClinicAssignModal";
import { ClinicPreviewModal } from "@/components/precision-clinic/ClinicPreviewModal";
import {
  countClinicPracticeItems,
  creatorDisplayName,
  formatRelativeTime,
  getClinicUpdatedAt,
} from "@/components/precision-clinic/clinic-drill-utils";

const PAGE_SIZE = 10;
const LIST_PATH = "/admin/precision-clinic";

type ClinicDrill = Record<string, unknown> & {
  _id: string;
  title: string;
  type: string;
  difficulty: string;
  context?: string;
  assignedLearnerIds?: unknown[];
  createdByEmail?: string;
  isArchived?: boolean;
  updatedAt?: string | Date;
  createdAt?: string | Date;
};

function parseFilters(searchParams: URLSearchParams): ClinicListFilters & { offset: number } {
  const offsetRaw = Number(searchParams.get("offset") ?? "0");
  return {
    q: searchParams.get("q") ?? "",
    type: searchParams.get("type") ?? "all",
    status: searchParams.get("status") ?? "all",
    difficulty: searchParams.get("difficulty") ?? "all",
    offset: Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0,
  };
}

function buildListPath(filters: ClinicListFilters & { offset: number }): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.difficulty !== "all") params.set("difficulty", filters.difficulty);
  if (filters.offset > 0) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return qs ? `${LIST_PATH}?${qs}` : LIST_PATH;
}

function PrecisionClinicPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busyAction, setBusyAction] = useState<{
    drillId: string;
    action: ClinicRowAction;
  } | null>(null);
  const [assignDrill, setAssignDrill] = useState<ClinicDrill | null>(null);
  const [previewDrill, setPreviewDrill] = useState<ClinicDrill | null>(null);
  const [deleteDrill, setDeleteDrill] = useState<ClinicDrill | null>(null);

  const deleteMutation = useDeletePrecisionClinic();
  const duplicateMutation = useDuplicatePrecisionClinic();
  const archiveMutation = useArchivePrecisionClinic();

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  const updateFilters = useCallback(
    (partial: Partial<ClinicListFilters & { offset: number }>) => {
      const next = { ...filters, ...partial };
      router.replace(buildListPath(next), { scroll: false });
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

  const hasActiveFilters = Boolean(
    filters.q.trim() ||
      filters.type !== "all" ||
      filters.status !== "all" ||
      filters.difficulty !== "all"
  );

  const listQuery = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: filters.offset,
      q: filters.q.trim() || undefined,
      type: filters.type !== "all" ? filters.type : undefined,
      difficulty: filters.difficulty !== "all" ? filters.difficulty : undefined,
      status:
        filters.status === "published" || filters.status === "draft"
          ? filters.status
          : undefined,
    }),
    [filters]
  );

  const { data, isLoading } = usePrecisionClinicList(listQuery);
  const drills = (data?.drills ?? []) as ClinicDrill[];
  const total = data?.total ?? 0;

  const stats: ClinicStatCardData = useMemo(() => {
    const s = data?.stats;
    return {
      totalDrills: s?.total ?? 0,
      practiceItems: s?.practiceItems ?? 0,
      publishedDrills: s?.published ?? 0,
      assignedDrills: s?.assigned ?? s?.published ?? 0,
    };
  }, [data?.stats]);

  const handleDuplicate = (drill: ClinicDrill) => {
    setBusyAction({ drillId: drill._id, action: "duplicate" });
    duplicateMutation.mutate(drill._id, {
      onSettled: () => setBusyAction(null),
    });
  };

  const handleArchive = (drill: ClinicDrill) => {
    setBusyAction({ drillId: drill._id, action: "archive" });
    archiveMutation.mutate(drill._id, {
      onSettled: () => setBusyAction(null),
    });
  };

  const handleRowAction = (drill: ClinicDrill, action: ClinicRowAction) => {
    switch (action) {
      case "view":
        router.push(`/admin/precision-clinic/${drill._id}`);
        break;
      case "edit":
        router.push(`/admin/precision-clinic/create?id=${drill._id}`);
        break;
      case "duplicate":
        handleDuplicate(drill);
        break;
      case "assign":
        setAssignDrill(drill);
        break;
      case "preview":
        setPreviewDrill(drill);
        break;
      case "archive":
        handleArchive(drill);
        break;
      case "delete":
        setDeleteDrill(drill);
        break;
      default:
        break;
    }
  };

  const confirmDelete = () => {
    if (!deleteDrill) return;
    deleteMutation.mutate(deleteDrill._id, {
      onSuccess: () => setDeleteDrill(null),
    });
  };

  const pageStart = total === 0 ? 0 : filters.offset + 1;
  const pageEnd = Math.min(filters.offset + PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(filters.offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
              Eklan Precision Clinic
            </h1>
            <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-muted-foreground">
              Create targeted drills to help your students improve their weak areas.
            </p>
          </div>
        </div>
        <Link
          href="/admin/precision-clinic/create"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#418b43] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a7c3b]"
        >
          <Plus className="h-4 w-4" />
          Create Clinic Drill
        </Link>
      </div>

      <ClinicStatCards stats={stats} loading={isLoading && !data} />

      <ClinicFiltersBar
        searchDraft={searchDraft}
        onSearchDraftChange={setSearchDraft}
        filters={filters}
        onFilterChange={(partial) => updateFilters({ ...partial, offset: 0 })}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        onClear={() => router.replace(LIST_PATH, { scroll: false })}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-border dark:bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-muted/40">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-muted-foreground">
                  Drill Title
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-muted-foreground">
                  Drill Type
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-muted-foreground">
                  Items
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-muted-foreground">
                  Difficulty
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-muted-foreground">
                  Updated
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : drills.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-gray-500 dark:text-muted-foreground"
                  >
                    {hasActiveFilters
                      ? "No clinic drills match your filters"
                      : "No Precision Clinic drills yet. Create your first clinic drill to get started."}
                  </td>
                </tr>
              ) : (
                drills.map((drill) => {
                  const itemCount = countClinicPracticeItems(drill);
                  const updatedAt = getClinicUpdatedAt(drill);
                  const rowBusy =
                    busyAction?.drillId === drill._id ? busyAction.action : null;
                  return (
                    <tr
                      key={drill._id}
                      className="transition-colors hover:bg-gray-50/80 dark:hover:bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <div className="min-w-0 max-w-xs">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-foreground">
                            {drill.title}
                          </p>
                          {drill.context ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-muted-foreground">
                              {drill.context}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ClinicTypeBadge type={drill.type} />
                      </td>
                      <td className="px-6 py-4 text-sm tabular-nums text-gray-700 dark:text-foreground">
                        {itemCount}
                      </td>
                      <td className="px-6 py-4">
                        <ClinicDifficultyBadge difficulty={drill.difficulty} />
                      </td>
                      <td className="px-6 py-4">
                        <ClinicStatusBadge drill={drill} />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700 dark:text-foreground">
                          {formatRelativeTime(updatedAt)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-muted-foreground">
                          by {creatorDisplayName(drill)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ClinicRowActionsMenu
                          drillTitle={drill.title}
                          busyAction={rowBusy}
                          disabled={Boolean(busyAction)}
                          onAction={(action) => handleRowAction(drill, action)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 dark:border-border sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              Showing {pageStart}–{pageEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateFilters({
                    offset: Math.max(0, filters.offset - PAGE_SIZE),
                  })
                }
                disabled={filters.offset === 0 || isLoading}
                className="rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:hover:bg-muted"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-16 text-center text-sm text-gray-600 dark:text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  updateFilters({ offset: filters.offset + PAGE_SIZE })
                }
                disabled={filters.offset + PAGE_SIZE >= total || isLoading}
                className="rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:hover:bg-muted"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {assignDrill ? (
        <ClinicAssignModal
          drillId={assignDrill._id}
          drillTitle={assignDrill.title}
          onClose={() => setAssignDrill(null)}
        />
      ) : null}

      {previewDrill ? (
        <ClinicPreviewModal
          drillId={previewDrill._id}
          drillTitle={previewDrill.title}
          onClose={() => setPreviewDrill(null)}
        />
      ) : null}

      {deleteDrill ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 dark:border-border dark:bg-card">
            <h3 className="text-lg font-bold text-gray-900 dark:text-foreground">
              Delete Drill
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-muted-foreground">
              Are you sure you want to delete &quot;{deleteDrill.title}&quot;?
              This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteDrill(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PrecisionClinicPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <PrecisionClinicPageContent />
    </Suspense>
  );
}
