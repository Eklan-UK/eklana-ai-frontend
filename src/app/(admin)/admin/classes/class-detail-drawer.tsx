"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Calendar,
  Clock,
  Video,
  Copy,
  FileText,
  RefreshCw,
  Check,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { ClassStatus, ClassType, TeachingClass } from "./types";
import { mergeClassDrawerDetail } from "./types";

type AttendanceOverride = "present" | "late" | "absent" | null;

function DrawerStatusPill({ status }: { status: ClassStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3d8c40]/40 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#2d6a32]">
        <Video className="h-3.5 w-3.5" strokeWidth={2} />
        Ongoing
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
      Upcoming
    </span>
  );
}

function classTypeLabel(type: ClassType) {
  return type === "group" ? "Group Class" : "Individual Class";
}

function avatarClasses(role: "Student" | "Tutor") {
  if (role === "Tutor") {
    return "bg-sky-600";
  }
  return "bg-[#2d6a32]";
}

interface ClassDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  session: TeachingClass | null;
}

export function ClassDetailDrawer({ open, onClose, session }: ClassDetailDrawerProps) {
  const detail = useMemo(
    () => (session ? mergeClassDrawerDetail(session) : null),
    [session],
  );

  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState<AttendanceOverride>(null);

  useEffect(() => {
    if (open && session) {
      setNotes("");
      setOverride(null);
    }
  }, [open, session?.id]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !session || !detail) return null;

  const isOngoing = session.status === "active";
  const isUpcoming = session.status === "upcoming";
  const isCompleted = session.status === "completed";

  const blockPct =
    detail.blockTotal > 0
      ? Math.min(100, (detail.blockCompleted / detail.blockTotal) * 100)
      : 0;
  const remaining = Math.max(0, detail.blockTotal - detail.blockCompleted);

  const canJoinMeet = isOngoing;
  const showMeetingLink = isOngoing || isUpcoming;

  const schedulePattern = `${session.scheduleDays} · ${session.timeRange.split(/\u2013/)[0]?.trim() ?? session.timeRange.split("-")[0]?.trim() ?? session.timeRange}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(detail.meetingUrl);
      toast.success("Meeting link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-[60] bg-black/40 transition-opacity"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.08)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-detail-title"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
            <div className="mb-6 flex items-start justify-between gap-3">
              <DrawerStatusPill status={session.status} />
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <h2
              id="class-detail-title"
              className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl"
            >
              Session {detail.sessionNumber} of {detail.sessionTotal}
            </h2>

            <button
              type="button"
              className="mt-2 flex w-full items-center gap-1 text-left text-base font-semibold text-slate-800 hover:text-slate-950"
            >
              <span>
                {session.studentLabel}
                {session.extraStudents > 0 ? (
                  <span className="font-semibold text-slate-500">
                    {" "}
                    +{session.extraStudents}
                  </span>
                ) : null}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            </button>

            <p className="mt-1 text-sm text-gray-500">
              <span>{detail.recurring ? "Recurring" : "One-off"}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              <span>{classTypeLabel(session.classType)}</span>
            </p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {detail.sessionDateLong}
            </p>

            <section className="mt-8">
              <h3 className="text-sm font-bold text-slate-900">Participants</h3>
              <ul className="mt-3 space-y-2.5">
                {detail.participants.map((p, idx) => (
                  <li key={`participant-${idx}-${p.initials}`}>
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClasses(p.role)}`}
                      >
                        {p.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-500">{p.role}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-8">
              <h3 className="text-sm font-bold text-slate-900">Schedule</h3>
              <div className="mt-3 space-y-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Date
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {detail.sessionDateLong}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 border-t border-gray-200/80 pt-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Time
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {detail.sessionTimeRange}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="text-sm font-bold text-slate-900">Meeting Access</h3>

              {isCompleted ? (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-100/80 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-gray-600">
                    This session has been completed
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!canJoinMeet}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold shadow-sm transition-colors ${
                      canJoinMeet
                        ? "bg-[#2d6a32] text-white hover:bg-[#245528]"
                        : "cursor-not-allowed bg-gray-200 text-white"
                    }`}
                  >
                    <Video className="h-5 w-5" strokeWidth={2} />
                    Join Session Now
                  </button>

                  {showMeetingLink ? (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-100 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-600">
                          Meeting Link (Admin Only)
                        </p>
                        <button
                          type="button"
                          onClick={copyLink}
                          className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-[#2d6a32]"
                          aria-label="Copy meeting link"
                        >
                          <Copy className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs font-medium text-sky-800">
                        {detail.meetingUrl}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </section>

            <section className="mt-8">
              <h3 className="text-sm font-bold text-slate-900">Attendance Status</h3>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Current Status</span>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Present
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                    <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                    Pending
                  </span>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-4">
                <p className="text-xs font-bold text-amber-900">Manual Override (Admin Only)</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "present" as const, label: "Present", Icon: Check },
                      { id: "late" as const, label: "Late", Icon: Clock },
                      { id: "absent" as const, label: "Absent", Icon: XCircle },
                    ] as const
                  ).map(({ id, label, Icon }) => {
                    const selected = override === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setOverride(selected ? null : id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-bold transition-colors ${
                          selected
                            ? "border-[#2d6a32] bg-white text-[#2d6a32] shadow-sm"
                            : "border-amber-200/80 bg-white/60 text-gray-600 hover:border-amber-300"
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileText className="h-4 w-4 text-gray-500" strokeWidth={2} />
                Session Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this session..."
                rows={4}
                className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-800 placeholder:text-gray-400 focus:border-[#2d6a32]/50 focus:outline-none focus:ring-2 focus:ring-[#2d6a32]/20"
              />
            </section>

            <section className="mt-8 border-t border-gray-100 pb-4 pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                <Calendar className="h-4 w-4 shrink-0 text-violet-600" strokeWidth={2} />
                {schedulePattern}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-gray-500">Progress</span>
                  <span className="font-bold text-slate-900">
                    {detail.blockCompleted} / {detail.blockTotal} sessions
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full ${isCompleted ? "bg-slate-600" : "bg-[#2d6a32]"}`}
                    style={{ width: `${blockPct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs font-semibold text-gray-500">
                  <span>{detail.blockCompleted} completed</span>
                  <span>{remaining} remaining</span>
                </div>
              </div>

              <div className="mt-4 text-sm">
                <span className="font-semibold text-gray-600">Next Session: </span>
                <span className="font-bold text-slate-900">
                  {isCompleted ? "N/A" : detail.nextSessionFull}
                </span>
              </div>
            </section>
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isCompleted}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-colors ${
                  isCompleted
                    ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400"
                    : "border-gray-200 bg-white text-slate-800 hover:bg-gray-50"
                }`}
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2} />
                Reschedule
              </button>
              {isCompleted ? (
                <button
                  type="button"
                  className="flex-1 rounded-2xl bg-[#2d6a32] py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#245528]"
                  onClick={() => {
                    toast.success("Schedule a new session from the Classes page");
                    onClose();
                  }}
                >
                  Add new session
                </button>
              ) : (
                <button
                  type="button"
                  className="flex-1 rounded-2xl bg-[#2d6a32] py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#245528]"
                  onClick={() => {
                    toast.success("Changes saved");
                    onClose();
                  }}
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
