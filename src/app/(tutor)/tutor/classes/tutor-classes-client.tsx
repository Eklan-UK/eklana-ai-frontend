"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Play,
  Check,
  Users,
  User,
  Video,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import type { ClassStatus, ClassType } from "@/app/(admin)/admin/classes/types";
import { useTutorClasses } from "@/hooks/useClasses";
import { adminDtoToTeachingClass } from "@/lib/classes/admin-dto-to-teaching";
import { TUTOR_JOIN_EARLY_MINUTES } from "@/domain/classes/class.mapper";

function formatHeaderDate() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600">
        <Check className="h-3 w-3" strokeWidth={2.5} />
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

export function TutorClassesClient() {
  const [tab, setTab] = useState<"today" | "upcoming">("today");
  const { data, isLoading, error } = useTutorClasses({ limit: 100 });

  const classes = useMemo(() => {
    const rows = data?.classes ?? [];
    return rows.map(adminDtoToTeachingClass);
  }, [data?.classes]);

  const todayCount = useMemo(
    () => classes.filter((c) => c.bucket === "today").length,
    [classes],
  );
  const upcomingCount = useMemo(
    () => classes.filter((c) => c.bucket === "upcoming").length,
    [classes],
  );

  const visibleClasses = useMemo(
    () => classes.filter((c) => c.bucket === tab),
    [classes, tab],
  );

  const headerDate = formatHeaderDate();

  return (
    <div className="relative space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your teaching sessions — join from here when it&apos;s time
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-full max-w-md items-center rounded-full border border-gray-200 bg-white px-2 py-1.5 sm:w-auto sm:max-w-none"
          role="tablist"
          aria-label="Class schedule filter"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "today"}
            onClick={() => setTab("today")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full py-2.5 pl-3 pr-2 text-sm transition-colors ${
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
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full py-2.5 pl-2 pr-3 text-sm transition-colors ${
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
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">
          {headerDate}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load classes.{" "}
          {error instanceof Error ? error.message : "Unknown error"}
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
            No classes in this tab. When admins schedule classes for you, they
            will appear here.
          </div>
        ) : null}
        {!isLoading &&
          visibleClasses.map((session) => {
            const progress =
              session.totalSessions > 0
                ? Math.min(
                    100,
                    (session.completedSessions / session.totalSessions) * 100,
                  )
                : 0;
            const joinUrl = session.meetingUrl?.trim();
            const canJoin = Boolean(joinUrl);

            return (
              <article
                key={session.id}
                className="flex flex-col rounded-[18px] border border-gray-200/80 bg-white p-6 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
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

                <div className="mb-4">
                  <ClassTypeBadge type={session.classType} />
                </div>

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

                <div className="mb-5 rounded-xl bg-gray-100 px-4 py-3.5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2 text-slate-600">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
                      <span className="font-medium leading-snug">{session.scheduleDays}</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
                      <span className="font-medium leading-snug">{session.timeRange}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                      Progress
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {session.completedSessions} of {session.totalSessions} completed
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200/90">
                    <div
                      className="h-full rounded-full bg-[#2d6a32] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5 text-left">
                  <p className="text-xs font-semibold text-sky-500">Next session</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {session.nextSessionLabel}
                  </p>
                </div>

                <div className="mt-auto space-y-2 pt-0.5">
                  {session.nextSessionId ? (
                    <Link
                      href={`/tutor/classes/session/${session.nextSessionId}`}
                      className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-gray-50"
                    >
                      <ClipboardList className="h-4 w-4 shrink-0" strokeWidth={2} />
                      Attendance
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canJoin}
                    title={
                      canJoin
                        ? "Open meeting in a new tab"
                        : `Join becomes available up to ${TUTOR_JOIN_EARLY_MINUTES} minutes before start`
                    }
                    onClick={() => {
                      if (!joinUrl) return;
                      window.open(joinUrl, "_blank", "noopener,noreferrer");
                    }}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-colors ${
                      canJoin
                        ? "bg-[#2d6a32] text-white shadow-sm hover:bg-[#245528]"
                        : "cursor-not-allowed bg-gray-100 text-gray-400"
                    }`}
                  >
                    <Video
                      className={`h-4 w-4 shrink-0 ${canJoin ? "text-white" : "text-gray-400"}`}
                      strokeWidth={2}
                    />
                    Join session
                  </button>
                  {!canJoin && session.status !== "completed" ? (
                    <p className="text-center text-xs text-gray-500">
                      Link appears up to {TUTOR_JOIN_EARLY_MINUTES} minutes before start
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
