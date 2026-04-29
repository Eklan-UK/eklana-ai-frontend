"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import { useAdminRescheduleSessionDirect, useAdminSession } from "@/hooks/useClasses";
import { RescheduleTag } from "@/components/classes/RescheduleTag";

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTimeOnly(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function AdminSessionRescheduleClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const { data, isLoading, error } = useAdminSession(sessionId);
  const canReschedule =
    !!data &&
    (data.session.status === "scheduled" ||
      data.session.status === "in_progress" ||
      data.session.status === "completed");
  const rescheduleDirect = useAdminRescheduleSessionDirect(sessionId);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  const sessionDurationMs = useMemo(() => {
    if (!data?.session) return 0;
    return (
      new Date(data.session.endUtc).getTime() -
      new Date(data.session.startUtc).getTime()
    );
  }, [data?.session]);

  useEffect(() => {
    if (data?.session) {
      const d = new Date(data.session.startUtc);
      setCustomDate(toDateInputValue(d));
      setCustomTime(toTimeInputValue(d));
    }
  }, [data?.session]);

  return (
    <div className="space-y-6 pb-8">
      <Link
        href="/admin/classes"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#2d6a32] hover:text-[#245528]"
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
          {canReschedule ? (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">Reschedule session</h1>
                  {data.session.isReschedule ? <RescheduleTag /> : null}
                </div>
                <p className="mt-1 text-sm text-gray-500">{data.classTitle}</p>
              </div>

              <div className="space-y-4 px-3 pb-4 pt-3 sm:px-4">
                <div className="rounded-2xl bg-gray-50 px-4 py-3.5">
                  <p className="text-sm text-gray-500">Current time</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {data.tutorName}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-gray-200/90 bg-white px-3.5 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Date
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
                        <span>
                          {formatShortDate(new Date(data.session.startUtc))}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200/90 bg-white px-3.5 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Time
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <Clock3 className="h-4 w-4 shrink-0 text-slate-500" />
                        <span>
                          {formatTimeOnly(new Date(data.session.startUtc))} –{" "}
                          {formatTimeOnly(new Date(data.session.endUtc))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-[#2d6a32]/30 bg-emerald-50/40 p-4">
                  <h2 className="text-base font-bold text-slate-900">
                    New time (any day)
                  </h2>
                  <p className="text-sm text-gray-600">
                    The previous Google Calendar event is removed and a new one is
                    created. Session length stays{" "}
                    {sessionDurationMs > 0
                      ? ` ${Math.round(sessionDurationMs / 60000)} minutes`
                      : " the same"}
                    .
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:max-w-2xl sm:grid-cols-2">
                    <div className="rounded-xl border border-white/50 bg-white/60 px-3.5 py-3 shadow-sm">
                      <label
                        className="block text-xs font-semibold uppercase tracking-wide text-gray-600"
                        htmlFor="admin-new-date"
                      >
                        New start — date
                      </label>
                      <input
                        id="admin-new-date"
                        type="date"
                        className="mt-2 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                      />
                    </div>
                    <div className="rounded-xl border border-white/50 bg-white/60 px-3.5 py-3 shadow-sm">
                      <label
                        className="block text-xs font-semibold uppercase tracking-wide text-gray-600"
                        htmlFor="admin-new-time"
                      >
                        New start — time
                      </label>
                      <input
                        id="admin-new-time"
                        type="time"
                        className="mt-2 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={rescheduleDirect.isPending}
                    onClick={() => {
                      if (!data?.session || sessionDurationMs <= 0) return;
                      const dateParts = customDate.split("-").map((s) => parseInt(s, 10));
                      const timeParts = customTime.split(":").map((s) => parseInt(s, 10));
                      const y = dateParts[0];
                      const mo = dateParts[1];
                      const day = dateParts[2];
                      const h = timeParts[0];
                      const min = timeParts[1];
                      if (
                        !customDate ||
                        !customTime ||
                        [y, mo, day, h, min].some(
                          (n) => n === undefined || Number.isNaN(n),
                        )
                      ) {
                        toast.error("Pick a valid date and time");
                        return;
                      }
                      const start = new Date(y, mo - 1, day, h, min, 0, 0);
                      if (Number.isNaN(start.getTime())) {
                        toast.error("Pick a valid date and time");
                        return;
                      }
                      if (start.getTime() <= Date.now()) {
                        toast.error("Start time must be in the future");
                        return;
                      }
                      const end = new Date(start.getTime() + sessionDurationMs);
                      rescheduleDirect.mutate({
                        newStartUtc: start.toISOString(),
                        newEndUtc: end.toISOString(),
                      });
                    }}
                    className="w-full max-w-md rounded-2xl bg-[#2d6a32] py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#245528] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rescheduleDirect.isPending
                      ? "Saving…"
                      : "Apply this time"}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-sm text-gray-600">
              This session can no longer be rescheduled.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
