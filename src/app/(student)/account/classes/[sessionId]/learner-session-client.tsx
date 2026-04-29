"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Clock3, Info } from "lucide-react";
import {
  useLearnerSession,
  useLearnerRescheduleOptions,
  useLearnerRescheduleSession,
  useLearnerReserveRescheduleSlot,
} from "@/hooks/useClasses";
import { RescheduleTag } from "@/components/classes/RescheduleTag";

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
    (data.session.status === "scheduled" ||
      data.session.status === "in_progress" ||
      data.session.status === "completed");
  const { data: optionsData, isLoading: optionsLoading } = useLearnerRescheduleOptions(sessionId, {
    enabled: canReschedule,
  });
  const reschedule = useLearnerRescheduleSession(sessionId);
  const reserve = useLearnerReserveRescheduleSlot(sessionId);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [hold, setHold] = useState<{
    reservationId: string;
    token: string;
  } | null>(null);
  const lastReserveKey = useRef<string | null>(null);

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
        <p className="text-sm text-text-secondary">Loading session…</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-100/70 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Could not load this session."}
        </div>
      ) : null}

      {data ? (
        <>
          {canReschedule ? (
            <section className="overflow-hidden rounded-2xl  bg-card">
              <div className="flex items-center justify-between px-4 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    Reschedule Session
                  </h2>
                  {data.session.isReschedule ? <RescheduleTag /> : null}
                </div>
              </div>

              <div className="space-y-4 px-3 pb-3 pt-3 sm:px-4">
                <div className="rounded-2xl bg-muted px-4 py-3.5">
                  <p className="text-sm text-text-secondary">Current Session</p>
                  <p className="mt-1 text-xl font-semibold leading-tight text-foreground">
                    {data.tutorName}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
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
                <div className="flex items-center gap-2 rounded-2xl border border-blue-300 bg-blue-100/70 px-4 py-3 text-sm text-blue-700">
                  <Info className="h-4 w-4 mr-2" />
                  You can only reschedule to another time slot within the same week.
                </div>
           

                <div className="space-y-3">
                  <h3 className="text-xl font-bold leading-tight text-foreground">
                    Available time slot
                  </h3>

                  {optionsLoading ? (
                    <p className="rounded-[16px] border border-border bg-card px-4 py-4 text-sm text-text-secondary">
                      Loading options...
                    </p>
                  ) : slotChoices.length === 0 ? (
                    <p className="rounded-[16px] border border-border bg-card px-4 py-4 text-sm text-text-secondary">
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
                            onClick={() => {
                              setSelectedSlot(slotKey);
                              setHold(null);
                              lastReserveKey.current = slotKey;
                              reserve.mutate(
                                { startUtc: slot.startUtc, endUtc: slot.endUtc },
                                {
                                  onSuccess: (data) => {
                                    if (lastReserveKey.current === slotKey) {
                                      setHold({
                                        reservationId: data.reservationId,
                                        token: data.token,
                                      });
                                    }
                                  },
                                  onError: (err) => {
                                    if (lastReserveKey.current === slotKey) {
                                      setHold(null);
                                    }
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Could not hold this time. Try another slot.",
                                    );
                                  },
                                },
                              );
                            }}
                            className={`w-full rounded-[16px] border px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border bg-muted"
                            }`}
                          >
                            <p className="text-xl font-medium leading-tight text-foreground">
                              {formatShortDate(startDate)}
                            </p>
                            <p className="mt-1.5 text-base leading-tight text-muted-foreground">
                              {formatTimeOnly(startDate)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 bg-card pb-1 pt-1">
                  <button
                    type="button"
                    disabled={
                      !selectedSlot ||
                      !hold ||
                      reserve.isPending ||
                      reschedule.isPending
                    }
                    onClick={() => {
                      const [newStartUtc, newEndUtc] = selectedSlot.split("|");
                      if (!newStartUtc || !newEndUtc || !hold) return;
                      reschedule.mutate({
                        newStartUtc,
                        newEndUtc,
                        reservationId: hold.reservationId,
                        reservationToken: hold.token,
                      });
                    }}
                    className="w-full rounded-full bg-muted px-4 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed enabled:bg-primary"
                  >
                    {reserve.isPending
                      ? "Holding time…"
                      : reschedule.isPending
                        ? "Saving..."
                        : "Continue"}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-sm text-text-secondary">This session can no longer be rescheduled.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
