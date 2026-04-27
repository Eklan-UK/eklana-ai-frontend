"use client";

import React, { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
} from "lucide-react";
import { useLearnerClasses, useLearnerPastSessions, useRecordLearnerAttendance } from "@/hooks/useClasses";
import { adminDtoToTeachingClass } from "@/lib/classes/admin-dto-to-teaching";
import { TUTOR_JOIN_EARLY_MINUTES } from "@/domain/classes/class.mapper";
import type { TeachingClass } from "@/app/(admin)/admin/classes/types";
import type { LearnerPastSessionItemDTO } from "@/domain/classes/class.api.types";
import {
  filterByTab,
  formatPastSessionTimeRange,
  formatSessionCardDate,
  joinButtonVariant,
  type MySessionsTab,
  parseSessionStartUtc,
  resolveCardBadge,
  resolvePastSessionBadge,
  tabForSessionRow,
} from "@/lib/classes/my-sessions";
import { BottomNav } from "@/components/layout/BottomNav";

const TAB_LABEL: Record<MySessionsTab, string> = {
  thisWeek: "This Week",
  upcoming: "Upcoming",
  past: "Past",
};

const GREEN = "#438E44";

function SessionCard({ session }: { session: TeachingClass }) {
  const recordAttendance = useRecordLearnerAttendance();
  const now = new Date();
  const joinUrl = session.meetingUrl?.trim();
  const canJoin = Boolean(joinUrl);
  const badge = resolveCardBadge(session, now);
  const jVariant = joinButtonVariant(session, canJoin, now);
  const start = parseSessionStartUtc(session);

  const dateLine = formatSessionCardDate(session.nextSessionStartUtc, now);
  const timeLine =
    session.drawer?.sessionTimeRange?.replace(/\s*-\s*/, " – ") ||
    session.timeRange?.replace(/\u2013/g, "–") ||
    "—";

  const joinClasses =
    jVariant === "live" || jVariant === "ready"
      ? "bg-[#2d6a32] text-white shadow-sm hover:bg-[#245528] disabled:opacity-50"
      : jVariant === "soon"
        ? "bg-amber-400 text-foreground hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
        : "cursor-not-allowed bg-muted text-muted-foreground";

  const badgeClass =
    badge.kind === "live"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : badge.kind === "completed"
        ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
        : badge.kind === "missed"
          ? "bg-amber-50 text-amber-900 border border-amber-200"
        : badge.kind === "startsIn"
          ? "bg-sky-50 text-sky-800 border border-sky-100"
          : "bg-sky-50 text-sky-800 border border-sky-100";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="text-sm font-bold text-foreground">{dateLine}</span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {badge.kind === "startsIn" ? (
            <Clock className="h-3 w-3" strokeWidth={2} />
          ) : null}
          {badge.label}
        </span>
      </div>

      <div className="mb-1 flex items-center gap-2 text-sm text-text-secondary">
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span>{timeLine}</span>
      </div>
      <p className="mb-4 text-sm text-text-secondary">{session.tutorName}</p>

      <div className="flex gap-2">
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
            if (session.nextSessionId) {
              void recordAttendance.mutate({ sessionId: session.nextSessionId });
            }
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-colors ${joinClasses}`}
        >
          <Video className="h-4 w-4 shrink-0" strokeWidth={2} />
          Join Session
        </button>
        {session.nextSessionId ? (
          <Link
            href={`/account/classes/${session.nextSessionId}`}
            className="flex flex-1 items-center justify-center rounded-full border border-border bg-card py-3 text-sm font-bold text-text-secondary transition-colors hover:bg-muted"
          >
            Reschedule
          </Link>
        ) : null}
      </div>

      {!canJoin && session.status !== "completed" && start && start > now ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Link appears up to {TUTOR_JOIN_EARLY_MINUTES} minutes before start
        </p>
      ) : null}
    </article>
  );
}

function PastSessionCard({ row }: { row: LearnerPastSessionItemDTO }) {
  const now = new Date();
  const { outcome, label } = resolvePastSessionBadge(row.learnerAttendance);
  const dateLine = formatSessionCardDate(row.startUtc, now);
  const timeLine = formatPastSessionTimeRange(row.startUtc, row.endUtc);
  const badgeClass =
    outcome === "attended"
      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
      : outcome === "excused"
        ? "bg-slate-100 text-slate-700 border border-slate-200"
        : "bg-amber-50 text-amber-900 border border-amber-200";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-1 text-sm font-bold text-foreground">{row.classTitle}</p>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="text-sm font-bold text-foreground">{dateLine}</span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {label}
        </span>
      </div>

      <div className="mb-1 flex items-center gap-2 text-sm text-text-secondary">
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span>{timeLine}</span>
      </div>
      <p className="text-sm text-text-secondary">{row.tutorName}</p>

      <div className="mt-4">
        <Link
          href={`/account/classes/${row.sessionId}`}
          className="flex w-full items-center justify-center rounded-full border border-border bg-card py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-muted"
        >
          Session details
        </Link>
      </div>
    </article>
  );
}

export function LearnerClassesClient() {
  const router = useRouter();
  const [tab, setTab] = useState<MySessionsTab>("thisWeek");

  const { data, isLoading, error } = useLearnerClasses({ limit: 100 });
  const {
    data: pastData,
    isLoading: pastLoading,
    error: pastError,
  } = useLearnerPastSessions({ limit: 100, offset: 0 });

  const classes = useMemo(() => {
    const rows = data?.classes ?? [];
    return rows.map(adminDtoToTeachingClass);
  }, [data?.classes]);

  const pastSessions = useMemo(() => {
    const list = pastData?.sessions ?? [];
    return [...list].sort(
      (a, b) => parseISO(b.startUtc).getTime() - parseISO(a.startUtc).getTime(),
    );
  }, [pastData?.sessions]);

  const pastTotal = pastData?.pagination?.total ?? pastSessions.length;

  const counts = useMemo(() => {
    const now = new Date();
    let thisWeek = 0;
    let upcoming = 0;
    for (const row of classes) {
      const t = tabForSessionRow(row, now);
      if (t === "thisWeek") thisWeek++;
      else if (t === "upcoming") upcoming++;
    }
    return { thisWeek, upcoming, past: pastTotal };
  }, [classes, pastTotal]);

  const visibleSeries = useMemo(() => {
    const now = new Date();
    return filterByTab(classes, tab, now);
  }, [classes, tab]);

  const listLoading = tab === "past" ? pastLoading : isLoading;
  const listError = tab === "past" ? pastError : error;
  const isEmpty =
    tab === "past"
      ? !pastLoading && pastSessions.length === 0
      : !isLoading && visibleSeries.length === 0;

  return (
    <div className="relative pb-28">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-gray-800 shadow-sm transition-colors hover:bg-muted"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h1 className="text-xl font-bold text-foreground">My Sessions</h1>
      </div>

      <div
        className="mb-6 flex rounded-full border border-gray-200 bg-muted p-1"
        role="tablist"
        aria-label="Session schedule"
      >
        {(["thisWeek", "upcoming", "past"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-full px-2 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
              tab === key
                ? "text-white shadow-sm"
                : "text-muted-foreground hover:text-gray-800"
            }`}
            style={
              tab === key
                ? { backgroundColor: GREEN, color: "white" }
                : undefined
            }
          >
            {TAB_LABEL[key]}
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums sm:text-xs ${
                tab === key ? "bg-white/25 text-white" : "bg-muted text-text-secondary"
              }`}
            >
              {key === "thisWeek"
                ? counts.thisWeek
                : key === "upcoming"
                  ? counts.upcoming
                  : counts.past}
            </span>
          </button>
        ))}
      </div>

      {listError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load sessions.{" "}
          {listError instanceof Error ? listError.message : "Unknown error"}
        </div>
      ) : null}

      {listLoading ? (
        <div className="rounded-2xl border border-border bg-white px-4 py-16 text-center text-sm text-muted-foreground">
          Loading sessions…
        </div>
      ) : null}

      {!listLoading && isEmpty ? (
        <div className="rounded-2xl border border-gray-200 bg-muted px-4 py-12 text-center text-sm text-text-secondary">
          No sessions in this tab.
        </div>
      ) : null}

      {!listLoading && tab === "past" && pastSessions.length > 0 ? (
        <div className="flex flex-col gap-4">
          {pastSessions.map((row) => (
            <PastSessionCard key={row.sessionId} row={row} />
          ))}
        </div>
      ) : null}

      {!listLoading && tab !== "past" && visibleSeries.length > 0 ? (
        <div className="flex flex-col gap-4">
          {visibleSeries.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
