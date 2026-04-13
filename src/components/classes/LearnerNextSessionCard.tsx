"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Video, Clock } from "lucide-react";
import {
  mergeClassDrawerDetail,
  type TeachingClass,
} from "@/app/(admin)/admin/classes/types";
import { useRecordLearnerAttendance } from "@/hooks/useClasses";
import { TUTOR_JOIN_EARLY_MINUTES } from "@/domain/classes/class.mapper";
import { formatStartsInLabel } from "@/lib/classes/pick-next-learner-session";

/** Bright cyan at bottom-right → deeper blue at top-left (see design mock). */
const NEXT_SESSION_CARD_BG: CSSProperties = {
  background:
    "linear-gradient(to top left,rgb(146, 218, 229) 0%,rgb(81, 174, 217) 45%,rgb(85, 123, 205) 100%)",
};

interface LearnerNextSessionCardProps {
  session: TeachingClass | null;
  isLoading: boolean;
}

export function LearnerNextSessionCard({
  session,
  isLoading,
}: LearnerNextSessionCardProps) {
  const recordAttendance = useRecordLearnerAttendance();

  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-5 shadow-lg animate-pulse min-h-[180px]"
        style={NEXT_SESSION_CARD_BG}
        aria-hidden
      />
    );
  }

  const startsIn = session
    ? formatStartsInLabel(session.nextSessionStartUtc)
    : null;
  const resolved = session ? mergeClassDrawerDetail(session) : null;
  const joinUrl = session?.meetingUrl?.trim();
  const canJoin = Boolean(joinUrl);
  const mainLine =
    session?.nextSessionLabel?.trim() ||
    session?.drawer?.nextSessionFull?.trim() ||
    "—";
  const subLine = session && resolved
    ? `${session.tutorName} • Session ${resolved.sessionNumber} of ${resolved.sessionTotal}`
    : null;

  return (
    <div
      className="rounded-2xl p-5 shadow-lg text-white"
      style={NEXT_SESSION_CARD_BG}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Video className="w-5 h-5 shrink-0 opacity-95" strokeWidth={2} />
          <span className="font-semibold text-sm">Next Session</span>
        </div>
        {startsIn ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {startsIn}
          </span>
        ) : session ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium shrink-0">
            <Clock className="w-3.5 h-3.5" />
            Upcoming
          </span>
        ) : null}
      </div>

      {session ? (
        <>
          <p className="text-xl font-bold leading-tight mb-1">{mainLine}</p>
          {subLine ? (
            <p className="text-sm text-white/90 mb-5">{subLine}</p>
          ) : (
            <div className="mb-5" />
          )}
        </>
      ) : (
        <p className="text-sm text-white/90 mb-5">
          No upcoming session scheduled. When your school adds one, it will
          appear here.
        </p>
      )}

      <div className="flex gap-2">
        <Link
          href="/account/classes"
          className="flex-1 text-center rounded-full bg-white/20 hover:bg-white/30 py-3 text-sm font-semibold transition-colors"
        >
          View all Sessions
        </Link>
        <button
          type="button"
          disabled={!session || !canJoin}
          title={
            !session
              ? undefined
              : canJoin
                ? "Open meeting in a new tab"
                : `Join becomes available up to ${TUTOR_JOIN_EARLY_MINUTES} minutes before start`
          }
          onClick={() => {
            if (!session || !joinUrl) return;
            window.open(joinUrl, "_blank", "noopener,noreferrer");
            if (session.nextSessionId) {
              void recordAttendance.mutate({ sessionId: session.nextSessionId });
            }
          }}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-colors ${
            session && canJoin
              ? "bg-white text-gray-900 shadow-md hover:bg-white/95 active:bg-gray-100"
              : "cursor-not-allowed bg-white/20 text-white/85 border border-white/30"
          }`}
        >
          <Video
            className={`h-4 w-4 shrink-0 ${session && canJoin ? "text-gray-900" : "text-white/70"}`}
            strokeWidth={2}
          />
          Join Session
        </button>
      </div>
    </div>
  );
}
