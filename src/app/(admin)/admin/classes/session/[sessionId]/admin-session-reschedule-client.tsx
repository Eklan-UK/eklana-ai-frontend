"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Info } from "lucide-react";
import {
  useAdminRescheduleOptions,
  useAdminRescheduleSession,
  useAdminSession,
} from "@/hooks/useClasses";

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
      data.session.status === "in_progress");
  const { data: optionsData, isLoading: optionsLoading } =
    useAdminRescheduleOptions(sessionId, { enabled: canReschedule });
  const reschedule = useAdminRescheduleSession(sessionId);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const slotChoices = useMemo(
    () =>
      [...(optionsData?.slots ?? [])].sort(
        (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
      ),
    [optionsData?.slots],
  );

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
                <h1 className="text-xl font-bold text-slate-900">Reschedule session</h1>
                <p className="mt-1 text-sm text-gray-500">{data.classTitle}</p>
              </div>

              <div className="space-y-4 px-3 pb-4 pt-3 sm:px-4">
                <div className="rounded-2xl bg-gray-50 px-4 py-3.5">
                  <p className="text-sm text-gray-500">Current time</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {data.tutorName}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      <span>
                        {formatShortDate(new Date(data.session.startUtc))}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4" />
                      <span>
                        {formatTimeOnly(new Date(data.session.startUtc))} –{" "}
                        {formatTimeOnly(new Date(data.session.endUtc))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>
                    You can only move this session to another time within the same
                    UTC week, matching tutor availability and avoiding conflicts.
                  </span>
                </div>

                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Choose a new time
                  </h2>

                  {optionsLoading ? (
                    <p className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                      Loading options…
                    </p>
                  ) : slotChoices.length === 0 ? (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      No alternative slots in this week with current rules. Adjust
                      tutor availability or try again later.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {slotChoices.map((slot) => {
                        const slotKey = `${slot.startUtc}|${slot.endUtc}`;
                        const startDate = new Date(slot.startUtc);
                        const isSelected = selectedSlot === slotKey;
                        return (
                          <button
                            key={slotKey}
                            type="button"
                            onClick={() => setSelectedSlot(slotKey)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? "border-[#2d6a32] bg-emerald-50/80"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <p className="text-base font-semibold text-slate-900">
                              {formatShortDate(startDate)}
                            </p>
                            <p className="mt-0.5 text-sm text-gray-600">
                              {formatTimeOnly(startDate)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!selectedSlot || reschedule.isPending}
                  onClick={() => {
                    const [newStartUtc, newEndUtc] = selectedSlot.split("|");
                    if (!newStartUtc || !newEndUtc) return;
                    reschedule.mutate({ newStartUtc, newEndUtc });
                  }}
                  className="w-full rounded-2xl bg-[#2d6a32] py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#245528] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reschedule.isPending ? "Saving…" : "Apply new time"}
                </button>
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
