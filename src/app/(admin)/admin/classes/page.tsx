"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Filter,
  Calendar,
  Clock,
  Play,
  Check,
  Users,
  User,
  Video,
  X,
  RefreshCw,
} from "lucide-react";
import type { ClassStatus, ClassType, TeachingClass } from "./types";
import { ClassDetailDrawer } from "./class-detail-drawer";
import { ScheduleClassModal } from "./schedule-class-modal";
import {
  useAdminClasses,
  useAdminClassesInfinite,
  useDeleteAdminClass,
} from "@/hooks/useClasses";
import { adminDtoToTeachingClass } from "@/lib/classes/admin-dto-to-teaching";
import { getClassCardScheduleBlock } from "@/lib/classes/class-card-schedule-display";
import { sortTeachingClassesByTab } from "@/lib/classes/sort-teaching-classes";

function formatHeaderDate(date?: Date) {
  const value = date ?? new Date();
  return value.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getScheduledDateKey(session: TeachingClass): string | null {
  if (session.nextSessionStartUtc) {
    const start = new Date(session.nextSessionStartUtc);
    if (!Number.isNaN(start.getTime())) {
      return toLocalDateKey(start);
    }
  }

  if (session.nextSessionLabel && session.nextSessionLabel !== "—") {
    const parsed = new Date(session.nextSessionLabel);
    if (!Number.isNaN(parsed.getTime())) {
      return toLocalDateKey(parsed);
    }
  }

  return null;
}

function StatusBadge({ status }: { status: ClassStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#3d8c40]/45 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#2d6a32]">
        <Play className="h-3 w-3 text-[#2d6a32]" strokeWidth={2.25} />
        Active
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
        <Check className="h-3 w-3 text-emerald-700" strokeWidth={2.5} />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
      <Clock className="h-3 w-3" strokeWidth={2.5} />
      Upcoming
    </span>
  );
}

function ClassTypeBadge({ type }: { type: ClassType }) {
  if (type === "group") {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-100/90 px-2.5 py-1 text-xs font-bold text-violet-700">
        <Users className="h-3.5 w-3.5 shrink-0 text-violet-600" strokeWidth={2} />
        Group Class
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100/90 px-2.5 py-1 text-xs font-bold text-amber-900">
      <User className="h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={2} />
      Individual Class
    </span>
  );
}

export default function AdminClassesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState<"today" | "upcoming" | "completed">("today");
  const [detailSession, setDetailSession] = useState<TeachingClass | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTypeChoiceOpen, setScheduleTypeChoiceOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      tabFromUrl === "today" ||
      tabFromUrl === "upcoming" ||
      tabFromUrl === "completed"
    ) {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (!filtersOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        filtersRef.current &&
        !filtersRef.current.contains(event.target as Node)
      ) {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [filtersOpen]);

  const { data: todayMeta } = useAdminClasses({ bucket: "today", limit: 1 });
  const { data: upcomingMeta } = useAdminClasses({
    bucket: "upcoming",
    limit: 1,
  });
  const { data: completedMeta } = useAdminClasses({
    bucket: "completed",
    limit: 1,
  });
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminClassesInfinite({ bucket: tab, limit: 100 });
  const deleteClass = useDeleteAdminClass();

  const handleRemoveSchedule = (classSeriesId: string) => {
    if (
      !window.confirm(
        "Remove this scheduled class? It will disappear from admin and tutor views.",
      )
    ) {
      return;
    }
    deleteClass.mutate(classSeriesId, {
      onSuccess: () => {
        setDetailSession((prev) => (prev?.id === classSeriesId ? null : prev));
      },
    });
  };

  const classes = useMemo(() => {
    const rows = data?.pages.flatMap((page) => page.classes) ?? [];
    return rows.map(adminDtoToTeachingClass);
  }, [data?.pages]);

  const detailId = detailSession?.id;
  useEffect(() => {
    if (detailId == null) return;
    const row = classes.find((c) => c.id === detailId);
    if (row) {
      setDetailSession(row);
    }
  }, [classes, detailId]);

  const todayCount = todayMeta?.pagination.total ?? 0;
  const upcomingCount = upcomingMeta?.pagination.total ?? 0;
  const completedCount = completedMeta?.pagination.total ?? 0;

  const visibleClasses = useMemo(() => {
    const filtered = filterDate
      ? classes.filter((c) => getScheduledDateKey(c) === filterDate)
      : classes;
    return sortTeachingClassesByTab(tab, filtered);
  }, [classes, tab, filterDate]);

  const headerDate = formatHeaderDate(
    filterDate ? new Date(`${filterDate}T12:00:00`) : undefined,
  );
  const hasDateFilter = Boolean(filterDate);

  return (
    <div className="relative space-y-6 pb-12">
      <ClassDetailDrawer
        open={detailSession !== null}
        onClose={() => setDetailSession(null)}
        session={detailSession}
      />
      <ScheduleClassModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onScheduled={(bucket) => setTab(bucket)}
      />
      {scheduleTypeChoiceOpen ? (
        <>
          <button
            type="button"
            aria-label="Close schedule type dialog"
            className="fixed inset-0 z-[60] cursor-default bg-black/40"
            onClick={() => setScheduleTypeChoiceOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-labelledby="schedule-type-title"
            aria-modal="true"
          >
            <h2
              id="schedule-type-title"
              className="text-lg font-bold text-gray-900"
            >
              Schedule a class
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose the type of schedule
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setScheduleTypeChoiceOpen(false);
                  setScheduleModalOpen(true);
                }}
                className="flex flex-col items-start gap-2 rounded-2xl border-2 border-gray-200 p-4 text-left transition-colors hover:border-[#3d8c40] hover:bg-emerald-50/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-slate-600">
                  <RefreshCw className="h-5 w-5" strokeWidth={2} />
                </div>
                <span className="font-bold text-slate-900">Recurring</span>
                <span className="text-xs text-gray-500">Weekly pattern</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScheduleTypeChoiceOpen(false);
                  router.push("/admin/classes/schedule-one-time");
                }}
                className="flex flex-col items-start gap-2 rounded-2xl border-2 border-gray-200 p-4 text-left transition-colors hover:border-[#3d8c40] hover:bg-emerald-50/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-slate-600">
                  <Calendar className="h-5 w-5" strokeWidth={2} />
                </div>
                <span className="font-bold text-slate-900">One-time</span>
                <span className="text-xs text-gray-500">Single class session</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setScheduleTypeChoiceOpen(false)}
              className="mt-4 w-full rounded-xl py-2 text-sm font-bold text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and join all your teaching sessions
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScheduleTypeChoiceOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#3d8c40] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#327035] focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/30"
        >
          <Plus className="h-4 w-4" />
          Schedule class
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-full max-w-2xl items-center rounded-full border border-gray-200 bg-white px-2 py-1.5 sm:w-auto sm:max-w-none"
          role="tablist"
          aria-label="Class schedule filter"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "today"}
            onClick={() => setTab("today")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 px-2 text-sm transition-colors sm:gap-2 sm:pl-3 sm:pr-2 ${
              tab === "today"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Clock
              className={`h-4 w-4 shrink-0 ${
                tab === "today" ? "text-gray-900" : "text-gray-400"
              }`}
              strokeWidth={2}
            />
            <span
              className={
                tab === "today"
                  ? "font-bold text-gray-900"
                  : "font-medium text-gray-500"
              }
            >
              Today
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-900">
              {todayCount}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upcoming"}
            onClick={() => setTab("upcoming")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 px-2 text-sm transition-colors sm:gap-2 sm:pl-2 sm:pr-2 ${
              tab === "upcoming"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar
              className={`h-4 w-4 shrink-0 ${
                tab === "upcoming" ? "text-gray-900" : "text-gray-400"
              }`}
              strokeWidth={2}
            />
            <span
              className={
                tab === "upcoming"
                  ? "font-bold text-gray-900"
                  : "font-medium text-gray-500"
              }
            >
              Upcoming
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-900">
              {upcomingCount}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "completed"}
            onClick={() => setTab("completed")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 px-2 text-sm transition-colors sm:gap-2 sm:pr-3 ${
              tab === "completed"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Check
              className={`h-4 w-4 shrink-0 ${
                tab === "completed" ? "text-gray-900" : "text-gray-400"
              }`}
              strokeWidth={2.5}
            />
            <span
              className={
                tab === "completed"
                  ? "font-bold text-gray-900"
                  : "font-medium text-gray-500"
              }
            >
              Completed
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-900">
              {completedCount}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`rounded-xl border px-4 py-2 text-sm font-medium ${
              hasDateFilter
                ? "border-[#3d8c40]/30 bg-emerald-50 text-[#2d6a32]"
                : "border-gray-100 bg-gray-50 text-gray-600"
            }`}
          >
            {hasDateFilter ? `Filtered: ${headerDate}` : headerDate}
          </div>
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              onClick={() => setFiltersOpen((open) => !open)}
              className={`inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 ${
                hasDateFilter
                  ? "border-[#3d8c40]/40 text-[#2d6a32]"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasDateFilter ? (
                <span className="rounded-full bg-[#3d8c40] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  1
                </span>
              ) : null}
            </button>

            {filtersOpen ? (
              <div
                role="dialog"
                aria-label="Filter classes by scheduled date"
                className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Filter by date
                  </h3>
                  <button
                    type="button"
                    aria-label="Close filters"
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Scheduled class date
                </label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#3d8c40]/40 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/20"
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate("");
                      setFiltersOpen(false);
                    }}
                    disabled={!hasDateFilter}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-lg bg-[#3d8c40] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#327035]"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load classes. {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-600">
          Loading classes…
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && visibleClasses.length === 0 ? (
          <div className="col-span-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">
            {hasDateFilter
              ? `No classes scheduled for ${headerDate} in this tab.`
              : "No classes yet. Schedule a class to get started."}
          </div>
        ) : null}
        {!isLoading &&
          visibleClasses.map((session) => {
          const progress =
            session.totalSessions > 0
              ? Math.min(
                  100,
                  (session.programPosition / session.totalSessions) * 100,
                )
              : 0;
          const joinUrl = session.meetingUrl?.trim();
          const canJoin = session.status === "active" && Boolean(joinUrl);
          const scheduleBlock = getClassCardScheduleBlock(session);

          return (
            <article
              key={session.id}
              className="relative flex flex-col rounded-[18px] border border-gray-200/80 bg-white p-6 shadow-sm"
            >
              <button
                type="button"
                aria-label="Remove schedule"
                disabled={deleteClass.isPending}
                onClick={() => handleRemoveSchedule(session.id)}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
              {/* Header: name + extra count vs status */}
              <div className="mb-2 flex items-start justify-between gap-3 pr-10">
                <h2 className="text-base font-bold leading-tight text-slate-900">
                  {session.studentLabel}
                  {session.extraStudents > 0 ? (
                    <span className="ml-1.5 text-sm font-medium text-slate-400">
                      +{session.extraStudents}
                    </span>
                  ) : null}
                </h2>
                <StatusBadge status={session.status} />
              </div>

              <p className="mb-3 text-xs font-medium text-gray-500">
                Tutor: {session.tutorName}
              </p>

              <div className="mb-4">
                <ClassTypeBadge type={session.classType} />
              </div>

              {/* Overlapping avatars — forest green */}
              <div className="mb-4 flex -space-x-2.5 pl-0.5">
                {session.participants.map((p, idx) => (
                  <div
                    key={`${session.id}-${idx}`}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border-[2.5px] border-white bg-[#2d6a32] text-[11px] font-bold tracking-tight text-white shadow-sm"
                    title={p.initials}
                  >
                    {p.initials}
                  </div>
                ))}
              </div>

              {/* Schedule — light grey block, two columns */}
              <div className="mb-5 rounded-xl bg-gray-100 px-4 py-3.5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2 text-slate-600">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
                    <span className="font-medium leading-snug">{scheduleBlock.dayLabel}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
                    <span className="font-medium leading-snug">{scheduleBlock.timeLabel}</span>
                  </div>
                </div>
              </div>

              {/* Progress label row + bar */}
              <div className="mb-5">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Progress
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {session.programPosition} of {session.totalSessions}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200/90">
                  <div
                    className="h-full rounded-full bg-[#2d6a32] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Next session — bordered light blue panel */}
              <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5 text-left">
                <p className="text-xs font-semibold text-sky-500">Next session</p>
                <p className="mt-0.5 text-base font-bold text-slate-900">
                  {session.nextSessionLabel}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-auto flex gap-3 pt-0.5">
                <button
                  type="button"
                  className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-gray-50"
                  onClick={() => setDetailSession(session)}
                >
                  View Details
                </button>
                <button
                  type="button"
                  disabled={!canJoin}
                  title={
                    canJoin
                      ? "Open meeting in a new tab"
                      : session.status === "active"
                        ? "No meeting link for this session yet"
                        : undefined
                  }
                  onClick={() => {
                    if (!joinUrl) return;
                    window.open(joinUrl, "_blank", "noopener,noreferrer");
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-colors ${
                    canJoin
                      ? "bg-[#2d6a32] text-white shadow-sm hover:bg-[#245528]"
                      : "cursor-not-allowed bg-gray-100 text-gray-400"
                  }`}
                >
                  {canJoin ? (
                    <Video className="h-4 w-4 shrink-0 text-white" strokeWidth={2} />
                  ) : (
                    <Video className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
                  )}
                  Join Session
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!isLoading && hasNextPage ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={isFetchingNextPage}
            onClick={() => {
              void fetchNextPage();
            }}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
