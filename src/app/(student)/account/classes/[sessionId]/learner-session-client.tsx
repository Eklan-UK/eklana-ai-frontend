"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import { useLearnerSession } from "@/hooks/useClasses";
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

  return (
    <div className="space-y-6 pb-24">
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
        <section className="overflow-hidden rounded-2xl bg-card">
          <div className="px-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">Session</h2>
              {data.session.isReschedule ? <RescheduleTag /> : null}
            </div>
            <p className="mt-1 text-sm text-text-secondary">{data.classTitle}</p>
          </div>

          <div className="space-y-4 px-3 pb-4 pt-3 sm:px-4">
            <div className="rounded-2xl bg-muted px-4 py-3.5">
              <p className="text-sm text-text-secondary">Tutor</p>
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
                    {formatTimeOnly(new Date(data.session.startUtc))} –{" "}
                    {formatTimeOnly(new Date(data.session.endUtc))}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-text-secondary">
              To change the day or time, your tutor or an administrator can reschedule this
              session.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
