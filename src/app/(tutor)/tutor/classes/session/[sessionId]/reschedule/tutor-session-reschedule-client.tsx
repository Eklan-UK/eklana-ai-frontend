"use client";

import Link from "next/link";
import { CalendarDays, Clock3, Info } from "lucide-react";
import { useTutorSession } from "@/hooks/useClasses";
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

/**
 * Self-serve time-slot picking is on hold. Tutors see current session time and
 * a notice to contact an admin to reschedule.
 */
export function TutorSessionRescheduleClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const { data, isLoading, error } = useTutorSession(sessionId);
  const canReschedule =
    !!data &&
    (data.session.status === "scheduled" ||
      data.session.status === "in_progress" ||
      data.session.status === "completed");

  return (
    <div className="space-y-6 pb-8">
      <Link
        href="/tutor/classes"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#2d6a32] hover:text-[#245528]"
      >
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
                  <h1 className="text-xl font-bold text-slate-900">Session time</h1>
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

                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    Choosing a new time is temporarily limited. If you need to
                    change this class to another time or day, an administrator can
                    update the schedule. Self-serve time options are on hold.
                  </p>
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
