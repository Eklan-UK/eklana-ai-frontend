"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Info, X } from "lucide-react";
import {
  useLearnerSession,
  useLearnerRescheduleOptions,
  useLearnerRescheduleSession,
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

export function LearnerSessionClient({ sessionId }: { sessionId: string }) {
  const { data, isLoading, error } = useLearnerSession(sessionId);
  const canReschedule =
    !!data &&
    (data.session.status === "scheduled" || data.session.status === "in_progress");
  const { data: optionsData, isLoading: optionsLoading } = useLearnerRescheduleOptions(sessionId, {
    enabled: canReschedule,
  });
  const reschedule = useLearnerRescheduleSession(sessionId);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const slotChoices = useMemo(
    () =>
      [...(optionsData?.slots ?? [])].sort(
        (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
      ),
    [optionsData?.slots],
  );

  return (
    <div className="space-y-6 pb-24">
      {/* replace: avoid stacking list + session in history; back from list should not return to session */}
      <Link
        href="/account/classes"
        replace
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
          {canReschedule ? (
            <section className="overflow-hidden rounded-2xl  bg-[#ffffff]">
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Reschedule Session
                </h2>
              </div>

              <div className="space-y-4 px-3 pb-3 pt-3 sm:px-4">
                <div className="rounded-2xl bg-[#fbfafd] px-4 py-3.5">
                  <p className="text-sm text-[#6b7280]">Current Session</p>
                  <p className="mt-1 text-xl font-semibold leading-tight text-[#111827]">
                    {data.tutorName}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#4b5563]">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      <span>{formatShortDate(new Date(data.session.startUtc))}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4" />
                      <span>
                        {formatTimeOnly(new Date(data.session.startUtc))} -{" "}
                        {formatTimeOnly(new Date(data.session.endUtc))}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <Info className="h-4 w-4 mr-2" />
                  You can only reschedule to another time slot within the same week.
                </div>
           

                <div className="space-y-3">
                  <h3 className="text-xl font-bold leading-tight text-neutral-900">
                    Available time slot
                  </h3>

                  {optionsLoading ? (
                    <p className="rounded-[16px] border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-600">
                      Loading options...
                    </p>
                  ) : slotChoices.length === 0 ? (
                    <p className="rounded-[16px] border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-600">
                      No other slots this week. Contact support if you need a different time.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {slotChoices.map((slot) => {
                        const slotKey = `${slot.startUtc}|${slot.endUtc}`;
                        const startDate = new Date(slot.startUtc);
                        const isSelected = selectedSlot === slotKey;
                        return (
                          <button
                            key={slotKey}
                            type="button"
                            onClick={() => setSelectedSlot(slotKey)}
                            className={`w-full rounded-[16px] border px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? "border-green-600 bg-green-50"
                                : "border-neutral-200 bg-[#f1f1f3]"
                            }`}
                          >
                            <p className="text-xl font-medium leading-tight text-[#111827]">
                              {formatShortDate(startDate)}
                            </p>
                            <p className="mt-1.5 text-base leading-tight text-[#9ca3af]">
                              {formatTimeOnly(startDate)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 bg-[#ffffff] pb-1 pt-1">
                  <button
                    type="button"
                    disabled={!selectedSlot || reschedule.isPending}
                    onClick={() => {
                      const [newStartUtc, newEndUtc] = selectedSlot.split("|");
                      if (!newStartUtc || !newEndUtc) return;
                      reschedule.mutate({ newStartUtc, newEndUtc });
                    }}
                    className="w-full rounded-full bg-[#d4d4d8] px-4 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed enabled:bg-green-700"
                  >
                    {reschedule.isPending ? "Saving..." : "Continue"}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-sm text-gray-600">This session can no longer be rescheduled.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
