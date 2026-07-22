"use client";

import Link from "next/link";
import { Star, Video, Clock } from "lucide-react";
import {
  mergeClassDrawerDetail,
  type TeachingClass,
} from "@/app/(admin)/admin/classes/types";
import { useRecordLearnerAttendance } from "@/hooks/useClasses";
import { TUTOR_JOIN_EARLY_MINUTES } from "@/domain/classes/class.mapper";
import { formatStartsInLabel } from "@/lib/classes/pick-next-learner-session";
import { RescheduleTag } from "@/components/classes/RescheduleTag";

const CARD_BG = "#2a602c";
const CTA_YELLOW = "#fbd100";

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
        className="rounded-[32px] p-6 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] animate-pulse min-h-[220px]"
        style={{ backgroundColor: CARD_BG }}
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
      className="rounded-[32px] p-6 text-white shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]"
      style={{ backgroundColor: CARD_BG }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1">
          <Star className="size-[11.5px] shrink-0 text-white" strokeWidth={2.25} fill="currentColor" />
          <span className="text-[10px] font-bold uppercase tracking-[1px] font-nunito text-white leading-[15px]">
            Upcoming Session
          </span>
        </div>
        {startsIn ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {startsIn}
          </span>
        ) : null}
      </div>

      {session?.nextSessionIsReschedule ? (
        <div className="mt-2">
          <RescheduleTag className="bg-white/25 border-white/40 text-white" />
        </div>
      ) : null}

      {session ? (
        <>
          <h2 className="pt-3 text-xl font-medium font-nunito leading-7 text-white">
            {mainLine}
          </h2>
          {subLine ? (
            <p className="mt-0.5 text-sm font-nunito leading-[19.25px] text-white/80">
              {subLine}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <h2 className="pt-3 text-xl font-medium font-nunito leading-7 text-white">
            Session Status
          </h2>
          <p className="mt-0.5 text-sm font-nunito leading-[19.25px] text-white/80">
            No upcoming session scheduled. When your tutor adds one, it will
            appear here.
          </p>
        </>
      )}

      <div className="flex flex-col gap-3 pt-7">
        <Link
          href="/account/classes"
          className="flex w-full items-center justify-center rounded-full py-4 text-base font-bold font-nunito text-[#171717] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] transition-opacity hover:opacity-95"
          style={{ backgroundColor: CTA_YELLOW }}
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
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full border border-solid py-[17px] text-base font-bold font-nunito transition-colors ${
            session && canJoin
              ? "cursor-pointer border-white/20 bg-white/15 text-white hover:bg-white/25"
              : "cursor-not-allowed border-white/5 bg-white/10 text-white/40"
          }`}
        >
          <Video
            className={`h-[13px] w-4 shrink-0 ${
              session && canJoin ? "text-white" : "text-white/40"
            }`}
            strokeWidth={2}
          />
          Join Session
        </button>
      </div>
    </div>
  );
}
