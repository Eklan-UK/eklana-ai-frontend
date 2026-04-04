"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Video, CalendarClock } from "lucide-react";
import {
  useLearnerSession,
  useRecordLearnerAttendance,
  useLearnerRescheduleOptions,
  useLearnerRescheduleSession,
} from "@/hooks/useClasses";
import { TUTOR_JOIN_EARLY_MINUTES } from "@/domain/classes/class.mapper";

export function LearnerSessionClient({ sessionId }: { sessionId: string }) {
  const { data, isLoading, error } = useLearnerSession(sessionId);
  const recordAttendance = useRecordLearnerAttendance();
  const canReschedule =
    !!data &&
    (data.session.status === "scheduled" || data.session.status === "in_progress");
  const { data: optionsData, isLoading: optionsLoading } = useLearnerRescheduleOptions(sessionId, {
    enabled: canReschedule,
  });
  const reschedule = useLearnerRescheduleSession(sessionId);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const meetingUrl = data?.session.meetingUrl?.trim();
  const canJoin = Boolean(meetingUrl);

  const slotChoices = useMemo(() => optionsData?.slots ?? [], [optionsData?.slots]);

  return (
    <div className="space-y-6 pb-24">
      <Link
        href="/account/classes"
        className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to classes
      </Link>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading session…</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Could not load this session."}
        </div>
      ) : null}

      {data ? (
        <>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.classTitle}</h1>
            <p className="mt-1 text-sm text-gray-600">Tutor: {data.tutorName}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p>
              <span className="font-medium text-gray-900">Starts: </span>
              {new Date(data.session.startUtc).toLocaleString()}
            </p>
            <p className="mt-2">
              <span className="font-medium text-gray-900">Ends: </span>
              {new Date(data.session.endUtc).toLocaleString()}
            </p>
            <p className="mt-2">
              <span className="font-medium text-gray-900">Status: </span>
              {data.session.status}
            </p>
          </div>

          <button
            type="button"
            disabled={!canJoin}
            onClick={() => {
              if (!meetingUrl) return;
              window.open(meetingUrl, "_blank", "noopener,noreferrer");
              void recordAttendance.mutate({ sessionId });
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-colors ${
              canJoin
                ? "bg-[#2d6a32] text-white shadow-sm hover:bg-[#245528]"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            <Video className={`h-5 w-5 ${canJoin ? "text-white" : "text-gray-400"}`} />
            Join session
          </button>
          {!canJoin && data.session.status !== "completed" ? (
            <p className="text-center text-xs text-gray-500">
              Join link is available up to {TUTOR_JOIN_EARLY_MINUTES} minutes before the session
              starts.
            </p>
          ) : null}

          {canReschedule ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="mb-3 flex items-center gap-2 text-amber-900">
                <CalendarClock className="h-5 w-5 shrink-0" />
                <h2 className="text-sm font-bold">Reschedule (same week)</h2>
              </div>
              <p className="mb-3 text-xs text-amber-900/80">
                You can only move this session within the same UTC week as the original time. Pick
                a slot below.
              </p>
              {optionsLoading ? (
                <p className="text-sm text-amber-900/70">Loading options…</p>
              ) : slotChoices.length === 0 ? (
                <p className="text-sm text-amber-900/80">
                  No other slots this week. Contact support if you need a different time.
                </p>
              ) : (
                <>
                  <label className="sr-only" htmlFor="reschedule-slot">
                    New time
                  </label>
                  <select
                    id="reschedule-slot"
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="mb-3 w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                  >
                    <option value="">Choose a new start time…</option>
                    {slotChoices.map((s) => (
                      <option key={s.startUtc} value={`${s.startUtc}|${s.endUtc}`}>
                        {new Date(s.startUtc).toLocaleString()} → {new Date(s.endUtc).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedSlot || reschedule.isPending}
                    onClick={() => {
                      const [newStartUtc, newEndUtc] = selectedSlot.split("|");
                      if (!newStartUtc || !newEndUtc) return;
                      reschedule.mutate({ newStartUtc, newEndUtc });
                    }}
                    className="w-full rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-300"
                  >
                    {reschedule.isPending ? "Saving…" : "Apply new time"}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
