"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  X,
  Search,
  Check,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Info,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { adminAPI } from "@/lib/api";
import { useCreateAdminClass } from "@/hooks/useClasses";
import { computeFirstSessionRange } from "@/lib/classes/first-session";
import type { CreateAdminClassBody } from "@/domain/classes/class.api.types";

const STEP_LABELS = ["Students", "Tutor", "Type", "Schedule", "Review"] as const;

/** Header stepper: one green for circles, labels, and connectors (matches review / confirm CTA) */
const STEPPER_GREEN = "#388E3C";

const REMINDER_OPTIONS = [
  "5 minutes before",
  "10 minutes before",
  "15 minutes before",
  "30 minutes before",
  "1 hour before",
] as const;

/** Visual match for date pill: "DD   MM   YYYY" spacing from native date value */
function formatIsoToDisplayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}   ${m.padStart(2, "0")}   ${y}`;
}

function formatReviewUntilSuffix(
  durationMode: "sessions" | "endDate",
  endsOnDateText: string,
  sessionCount: number,
): string {
  if (durationMode === "endDate" && endsOnDateText.trim()) {
    const raw = endsOnDateText.trim().replace(/\s+/g, " ");
    const parts = raw.split(" ").filter(Boolean);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (y?.length === 4 && d && m) {
        return `Until ${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
    return `Until ${raw}`;
  }
  return `Until ${sessionCount} session${sessionCount !== 1 ? "s" : ""}`;
}

interface PickerStudent {
  id: string;
  name: string;
  initials: string;
  level: string;
  sessionsLeft: number;
  avatarClass: string;
}

function userToPickerStudent(u: {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): PickerStudent {
  const id = u._id != null ? String(u._id) : "";
  const name =
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "User";
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return {
    id,
    name,
    initials,
    level: "—",
    sessionsLeft: 0,
    avatarClass: "bg-[#2d6a32]",
  };
}

interface TutorOption {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  capacityPct: number;
  googleCalendarConnected: boolean;
  recommended?: boolean;
}

function userToTutorOption(u: {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  googleCalendarConnected?: boolean;
}): TutorOption {
  const id = u._id != null ? String(u._id) : "";
  const name =
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "Tutor";
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return {
    id,
    name,
    initials,
    specialty: "Tutor",
    capacityPct: 50,
    googleCalendarConnected: !!u.googleCalendarConnected,
  };
}

type ClassTypeOption = "one-time" | "recurring";

type DurationMode = "sessions" | "endDate";

interface ScheduleClassModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful API create; parent may switch tab. */
  onScheduled?: (bucket: "today" | "upcoming") => void;
}

export function ScheduleClassModal({
  open,
  onClose,
  onScheduled,
}: ScheduleClassModalProps) {
  const createClass = useCreateAdminClass();

  const { data: learnersRes, isLoading: learnersLoading } = useQuery({
    queryKey: ["admin", "learners", "schedule-class-modal"],
    queryFn: () => adminAPI.getAllLearners({ limit: 200 }),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: tutorsRes, isLoading: tutorsLoading } = useQuery({
    queryKey: ["admin", "users", "tutors", "schedule-class-modal"],
    queryFn: () => adminAPI.getAllUsers({ role: "tutor", limit: 200 }),
    enabled: open,
    staleTime: 60_000,
  });

  const apiLearners = useMemo(
    () =>
      (learnersRes?.data?.learners ?? []).map((u: Record<string, unknown>) =>
        userToPickerStudent(u as Parameters<typeof userToPickerStudent>[0]),
      ),
    [learnersRes?.data?.learners],
  );

  const apiTutors = useMemo(
    () =>
      (tutorsRes?.users ?? []).map((u: Record<string, unknown>) =>
        userToTutorOption(u as Parameters<typeof userToTutorOption>[0]),
      ),
    [tutorsRes?.users],
  );

  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [classType, setClassType] = useState<ClassTypeOption | null>(null);
  const [scheduleDays, setScheduleDays] = useState<string[]>(["Mon", "Thu"]);
  const [scheduleStartTime, setScheduleStartTime] = useState("");
  const [scheduleEndTime, setScheduleEndTime] = useState("");
  const [durationMode, setDurationMode] = useState<DurationMode>("sessions");
  const [sessionCount, setSessionCount] = useState(12);
  /** Shown in "Ends on" pill (typed or filled via calendar picker) */
  const [endsOnDateText, setEndsOnDateText] = useState("");
  const endsDatePickerRef = useRef<HTMLInputElement>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderBeforeSession, setReminderBeforeSession] =
    useState<(typeof REMINDER_OPTIONS)[number]>("10 minutes before");
  const [reminderSecondary, setReminderSecondary] =
    useState<(typeof REMINDER_OPTIONS)[number]>("30 minutes before");
  /** Index of connector segment animating fill (between step i and i+1) */
  const [animatingLineIndex, setAnimatingLineIndex] = useState<number | null>(
    null,
  );
  /** Tutor step circle pulse right after line fill completes */
  const [tutorStepPulse, setTutorStepPulse] = useState(false);
  /** Review step circle pulse after Schedule → Review transition */
  const [reviewStepPulse, setReviewStepPulse] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STEP_ADVANCE_MS = 600;

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

  /* eslint-disable react-hooks/set-state-in-effect -- full wizard reset when modal opens */
  useEffect(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (!open) return;
    setStep(0);
    setSearch("");
    setTutorSearch("");
    setSelectedIds(new Set());
    setTutorId(null);
    setClassType(null);
    setScheduleDays(["Mon", "Thu"]);
    setScheduleStartTime("");
    setScheduleEndTime("");
    setDurationMode("sessions");
    setSessionCount(12);
    setEndsOnDateText("");
    setRemindersEnabled(true);
    setReminderBeforeSession("10 minutes before");
    setReminderSecondary("30 minutes before");
    setAnimatingLineIndex(null);
    setTutorStepPulse(false);
    setReviewStepPulse(false);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apiLearners;
    return apiLearners.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.level.toLowerCase().includes(q),
    );
  }, [search, apiLearners]);

  const filteredTutors = useMemo(() => {
    const q = tutorSearch.trim().toLowerCase();
    if (!q) return apiTutors;
    return apiTutors.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.specialty.toLowerCase().includes(q),
    );
  }, [tutorSearch, apiTutors]);

  const formatLevelLabel = (level: string) =>
    level.replace(/\s*-\s*/, " · ");

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasStudentSelection = selectedIds.size > 0;

  const stepSubtitle = useMemo(() => {
    switch (step) {
      case 0:
        return "Select a student for this class";
      case 1:
        return "Assign a tutor to this class";
      case 2:
        return "Choose between one-time or recurring class";
      case 3:
        return "Configure the class schedule.";
      case 4:
        return "Review and confirm the class details";
      default:
        return "";
    }
  }, [step]);

  const primaryLabelStep0 = hasStudentSelection
    ? "Continue to Assign Tutor"
    : "Select a student";

  const primaryLabelStep1 = tutorId
    ? "Continue to type"
  : "Select a connected tutor to continue";

  const primaryLabelStep2 = classType
    ? "Continue to schedule"
    : "Select a class type";

  const scheduleStepComplete =
    scheduleDays.length > 0 &&
    scheduleStartTime.trim() !== "" &&
    scheduleEndTime.trim() !== "" &&
    (durationMode === "sessions"
      ? sessionCount >= 1
      : endsOnDateText.trim() !== "");

  const primaryLabelStep3 = scheduleStepComplete
    ? "Continue to review"
    : "Complete schedule to continue";

  const selectionBadgeText = useMemo(() => {
    const n = selectedIds.size;
    if (n === 0) return null;
    if (n === 1) return "1 student - Individual Class";
    return `${n} students - Group Class`;
  }, [selectedIds.size]);

  const canContinue = () => {
    if (step === 0) return hasStudentSelection;
    if (step === 1) return tutorId !== null;
    if (step === 2) return classType !== null;
    if (step === 3) return scheduleStepComplete;
    return true;
  };

  const handlePrimary = async () => {
    if (step < STEP_LABELS.length - 1) {
      if (!canContinue()) return;
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      const from = step;
      setAnimatingLineIndex(from);
      advanceTimerRef.current = setTimeout(() => {
        const nextStep = from + 1;
        setStep(nextStep);
        setAnimatingLineIndex(null);
        advanceTimerRef.current = null;
        if (from === 2) {
          setScheduleStartTime((st) =>
            st.trim() === "" ? "09:00" : st,
          );
          setScheduleEndTime((et) =>
            et.trim() === "" ? "10:30" : et,
          );
        }
        if (nextStep === 1) {
          setTutorStepPulse(true);
          window.setTimeout(() => setTutorStepPulse(false), 500);
        }
        if (nextStep === 4) {
          setReviewStepPulse(true);
          window.setTimeout(() => setReviewStepPulse(false), 500);
        }
      }, STEP_ADVANCE_MS);
      return;
    }

    const students = apiLearners.filter((s) => selectedIds.has(s.id));
    const t = apiTutors.find((x) => x.id === tutorId);
    if (!t || students.length === 0 || classType === null) {
      toast.error("Could not create class — missing selections.");
      onClose();
      return;
    }

    if (learnersLoading || tutorsLoading) {
      toast.error("Still loading learners and tutors…");
      return;
    }

    try {
      const { start, end } = computeFirstSessionRange(
        scheduleDays,
        scheduleStartTime,
        scheduleEndTime,
      );
      const body: CreateAdminClassBody = {
        tutorId: t.id,
        learnerIds: students.map((s) => s.id),
        classType: students.length > 1 ? "group" : "individual",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        firstSessionStart: start.toISOString(),
        firstSessionEnd: end.toISOString(),
        recurrence:
          classType === "recurring"
            ? { rule: "weekly", totalSessions: sessionCount }
            : { rule: "none" },
        scheduleDayLabels: scheduleDays,
        scheduleStartTime,
        scheduleEndTime,
        totalSessionsPlanned:
          durationMode === "sessions" ? sessionCount : 12,
      };
      const result = await createClass.mutateAsync(body);
      const raw = result?.data?.class?.bucket;
      const bucket: "today" | "upcoming" =
        raw === "today" || raw === "upcoming" ? raw : "upcoming";
      onScheduled?.(bucket);
      onClose();
    } catch {
      /* useCreateAdminClass shows error toast */
    }
  };

  const handleBack = () => {
    if (animatingLineIndex !== null) {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      setAnimatingLineIndex(null);
      return;
    }
    if (step === 0) onClose();
    else setStep((s) => s - 1);
  };

  if (!open) return null;

  const selectedStudents = apiLearners.filter((s) => selectedIds.has(s.id));
  const tutor = apiTutors.find((t) => t.id === tutorId);
  const studentCount = selectedIds.size;
  /** Defense in depth: block confirm if tutor row is missing or not Google-connected */
  const scheduleBlockedNoGoogleCalendar =
    !!tutorId && (!tutor || !tutor.googleCalendarConnected);
  const reviewStepIndex = STEP_LABELS.length - 1;

  return (
    <>
      <style>{`
        @keyframes schedule-stepper-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes schedule-tutor-circle-pop {
          0% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(61, 140, 64, 0.35); }
          55% { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(61, 140, 64, 0.12); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(61, 140, 64, 0); }
        }
        .animate-schedule-stepper-fill {
          animation: schedule-stepper-fill 0.6s cubic-bezier(0.33, 1, 0.68, 1) forwards;
        }
        .animate-schedule-tutor-step {
          animation: schedule-tutor-circle-pop 0.5s ease-out forwards;
        }
      `}</style>
      <div
        className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-class-title"
      >
        <div className="flex max-h-[min(92vh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl">
          <header className="shrink-0 border-b border-gray-100 px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 pr-4">
                <h2
                  id="schedule-class-title"
                  className="text-xl font-bold leading-tight tracking-tight text-slate-900"
                >
                  Schedule New Class
                </h2>
                <p className="mt-1.5 text-sm leading-snug text-gray-500">
                  {stepSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 -mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div
              className="mt-5 flex w-full min-w-0 items-center overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Progress"
            >
              {STEP_LABELS.map((label, i) => {
                const num = i + 1;
                const last = i === STEP_LABELS.length - 1;
                /** During line fill we haven't advanced `step` yet — mark current + prior steps complete */
                const lineBusy =
                  animatingLineIndex !== null && step === animatingLineIndex;
                const done =
                  i < step ||
                  (lineBusy && animatingLineIndex !== null && i <= animatingLineIndex);
                const active = i === step && !done;
                const circlePulse =
                  (step === 1 && i === 1 && tutorStepPulse && !lineBusy) ||
                  (step === 4 && i === 4 && reviewStepPulse && !lineBusy);
                return (
                  <React.Fragment key={label}>
                    <div className="flex shrink-0 items-center gap-2">
                      <div
                        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          done || active
                            ? "text-white"
                            : "bg-gray-100 text-gray-400"
                        } ${circlePulse ? "animate-schedule-tutor-step" : ""}`}
                        style={
                          done || active
                            ? { backgroundColor: STEPPER_GREEN }
                            : undefined
                        }
                      >
                        {done ? (
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        ) : (
                          num
                        )}
                      </div>
                      <span
                        className={`whitespace-nowrap text-[11px] sm:text-xs ${
                          done
                            ? "font-semibold"
                            : active
                              ? "font-bold text-slate-900"
                              : "font-medium text-gray-400"
                        }`}
                        style={
                          done ? { color: STEPPER_GREEN } : undefined
                        }
                      >
                        {label}
                      </span>
                    </div>
                    {!last ? (
                      <div
                        className="relative mx-1.5 mb-0.5 h-1 min-w-[8px] flex-1 self-center overflow-hidden rounded-full bg-gray-200"
                        aria-hidden
                      >
                        <div
                          className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${
                            animatingLineIndex === i
                              ? "scale-x-0 animate-schedule-stepper-fill"
                              : ""
                          } ${
                            step > i && animatingLineIndex !== i
                              ? "scale-x-100"
                              : ""
                          } ${
                            step <= i && animatingLineIndex !== i
                              ? "scale-x-0"
                              : ""
                          }`}
                          style={{
                            backgroundColor: STEPPER_GREEN,
                          }}
                        />
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {step === 0 ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-gray-900">
                    Select Students
                  </h3>
                  {selectionBadgeText ? (
                    <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1.5 text-center text-xs font-bold leading-tight text-violet-900">
                      {selectionBadgeText}
                    </span>
                  ) : null}
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search students..."
                    className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#3d8c40]/50 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/15"
                  />
                </div>
                <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredStudents.map((s) => {
                    const checked = selectedIds.has(s.id);
                    const lowSessions = s.sessionsLeft <= 3;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => toggleStudent(s.id)}
                          className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-3 text-left transition-colors ${
                            checked
                              ? "border-[#2d6a32] bg-[#ecfdf5]"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                              checked
                                ? "border-[#2d6a32] bg-[#2d6a32] text-white"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {checked ? (
                              <Check className="h-3 w-3" strokeWidth={3} />
                            ) : null}
                          </span>
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                              checked
                                ? `ring-2 ring-white ${s.avatarClass}`
                                : "bg-gray-500"
                            }`}
                          >
                            {s.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900">{s.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatLevelLabel(s.level)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                              lowSessions
                                ? "bg-amber-50 text-amber-900"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {s.sessionsLeft} left
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h3 className="text-base font-bold text-gray-900">Assign Tutor</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a tutor for {studentCount}{" "}
                  {studentCount === 1 ? "student" : "students"}
                </p>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={tutorSearch}
                    onChange={(e) => setTutorSearch(e.target.value)}
                    placeholder="Search tutors..."
                    className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#3d8c40]/50 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/15"
                  />
                </div>
                <ul className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-1">
                  {filteredTutors.map((t) => {
                    const sel = tutorId === t.id;
                    const disabled = !t.googleCalendarConnected;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          title={
                            disabled
                              ? "Tutor must connect Google Calendar before scheduling"
                              : undefined
                          }
                          onClick={() => {
                            if (!disabled) setTutorId(t.id);
                          }}
                          className={`flex w-full gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                            disabled
                              ? "cursor-not-allowed border-amber-200 bg-amber-50/50 opacity-70"
                              : ""
                          } ${
                            sel
                              ? "border-[#3d8c40]/60 bg-emerald-50/40"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                            {t.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-slate-900">
                                    {t.name}
                                  </p>
                                  {t.googleCalendarConnected ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                      <Check
                                        className="h-3 w-3"
                                        strokeWidth={2.5}
                                        aria-hidden
                                      />
                                      Meet ready
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {t.specialty}
                                </p>
                                {!t.googleCalendarConnected ? (
                                  <p className="mt-1 text-xs font-semibold text-amber-700">
                                    Connect Google Calendar required
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                {t.recommended ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                    <Info
                                      className="h-3 w-3"
                                      strokeWidth={2.5}
                                    />
                                    Recommended
                                  </span>
                                ) : null}
                                {sel ? (
                                  <span
                                    className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2d6a32] text-white shadow-sm"
                                    aria-hidden
                                  >
                                    <Check
                                      className="h-3 w-3"
                                      strokeWidth={2.5}
                                    />
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className="h-full rounded-full bg-[#2d6a32] transition-[width] duration-300"
                                  style={{ width: `${t.capacityPct}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-xs font-bold tabular-nums text-gray-700">
                                {t.capacityPct}%
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h3 className="text-base font-bold text-gray-900">Class Type</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Choose between a one-time session or recurring classes
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: "one-time" as const,
                        title: "One-time",
                        desc: "Single session",
                        icon: Calendar,
                      },
                      {
                        id: "recurring" as const,
                        title: "Recurring",
                        desc: "Multiple sessions",
                        icon: RefreshCw,
                      },
                    ] as const
                  ).map((opt) => {
                    const sel = classType === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setClassType(opt.id)}
                        className={`rounded-2xl border-2 p-5 text-left transition-colors ${
                          sel
                            ? "border-[#3d8c40] bg-emerald-50/40"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                            sel
                              ? "bg-[#2d6a32] text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <Icon className="h-5 w-5" strokeWidth={2} />
                        </div>
                        <p className="font-bold text-slate-900">{opt.title}</p>
                        <p className="mt-1 text-sm text-gray-500">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h3 className="text-base font-bold text-gray-900">
                  Configure Schedule
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {classType === "recurring"
                    ? "Set up recurring class schedule."
                    : "Set up your class session schedule."}
                </p>

                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Select Days
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                        (d) => {
                          const on = scheduleDays.includes(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                setScheduleDays((prev) =>
                                  on
                                    ? prev.filter((x) => x !== d)
                                    : [...prev, d],
                                );
                              }}
                              className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                                on
                                  ? "border-[#2d6a32] bg-[#2d6a32] text-white"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                              }`}
                            >
                              {d}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="schedule-start"
                        className="text-sm font-semibold text-gray-800"
                      >
                        Start Time
                      </label>
                      <input
                        id="schedule-start"
                        type="time"
                        value={scheduleStartTime}
                        onChange={(e) =>
                          setScheduleStartTime(e.target.value)
                        }
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#3d8c40]/50 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/15"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="schedule-end"
                        className="text-sm font-semibold text-gray-800"
                      >
                        End Time
                      </label>
                      <input
                        id="schedule-end"
                        type="time"
                        value={scheduleEndTime}
                        onChange={(e) => setScheduleEndTime(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#3d8c40]/50 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/15"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Duration
                    </p>
                    <div
                      className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label="How the class series ends"
                    >
                      <div
                        role="radio"
                        aria-checked={durationMode === "sessions"}
                        tabIndex={0}
                        onClick={() => setDurationMode("sessions")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDurationMode("sessions");
                          }
                        }}
                        className={`flex min-h-[3rem] cursor-pointer items-center gap-3 rounded-[22px] border bg-white px-4 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#3d8c40]/40 ${
                          durationMode === "sessions"
                            ? "border-[#3d8c40] ring-1 ring-[#3d8c40]/35"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="shrink-0 text-sm font-medium text-[#4A5568]">
                          Ends after
                        </span>
                        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                          <div className="inline-flex items-center rounded-[10px] border border-slate-200 bg-white px-1">
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={sessionCount}
                              onFocus={() => setDurationMode("sessions")}
                              onChange={(e) => {
                                setDurationMode("sessions");
                                setSessionCount(
                                  Math.max(
                                    1,
                                    Number.parseInt(e.target.value, 10) || 1,
                                  ),
                                );
                              }}
                              className={`h-8 min-w-[3.5rem] max-w-[4.5rem] border-0 bg-transparent px-0.5 text-center text-sm font-semibold tabular-nums text-[#2D3748] focus:outline-none focus:ring-0 [appearance:auto] ${
                                durationMode !== "sessions" ? "opacity-60" : ""
                              }`}
                              aria-label="Number of sessions"
                            />
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-[#4A5568]">
                          sessions
                        </span>
                      </div>

                      <div
                        role="radio"
                        aria-checked={durationMode === "endDate"}
                        tabIndex={0}
                        onClick={() => setDurationMode("endDate")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDurationMode("endDate");
                          }
                        }}
                        className={`flex min-h-[3rem] cursor-pointer items-center gap-3 rounded-[22px] border bg-white px-4 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#3d8c40]/40 ${
                          durationMode === "endDate"
                            ? "border-[#3d8c40] ring-1 ring-[#3d8c40]/35"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="shrink-0 text-sm font-medium text-[#4A5568]">
                          Ends on
                        </span>
                        <div className="flex min-h-[2.25rem] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-2.5 py-1">
                          <input
                            id="ends-on-display"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="DD   MM   YYYY"
                            value={endsOnDateText}
                            onFocus={() => setDurationMode("endDate")}
                            onChange={(e) => {
                              setDurationMode("endDate");
                              setEndsOnDateText(e.target.value);
                            }}
                            className={`min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm text-[#2D3748] placeholder:text-slate-400 focus:outline-none focus:ring-0 ${
                              durationMode !== "endDate" ? "opacity-60" : ""
                            }`}
                            aria-label="End date"
                          />
                          <input
                            ref={endsDatePickerRef}
                            type="date"
                            className="sr-only"
                            tabIndex={-1}
                            aria-hidden
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v) {
                                setDurationMode("endDate");
                                setEndsOnDateText(formatIsoToDisplayDate(v));
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="shrink-0 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Open calendar"
                            onClick={(e) => {
                              e.preventDefault();
                              setDurationMode("endDate");
                              const el = endsDatePickerRef.current;
                              if (!el) return;
                              if (typeof el.showPicker === "function") {
                                el.showPicker();
                              } else {
                                el.click();
                              }
                            }}
                          >
                            <Calendar className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-800">
                        Reminder Configuration
                      </p>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={remindersEnabled}
                        onClick={() => setRemindersEnabled((v) => !v)}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d8c40] focus-visible:ring-offset-2 ${
                          remindersEnabled ? "bg-[#2d6a32]" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                            remindersEnabled
                              ? "left-0.5 translate-x-5"
                              : "left-0.5 translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div
                      className={`mt-3 grid gap-3 sm:grid-cols-2 ${
                        remindersEnabled ? "" : "pointer-events-none opacity-45"
                      }`}
                    >
                      <div className="relative">
                        <select
                          value={reminderBeforeSession}
                          onChange={(e) =>
                            setReminderBeforeSession(
                              e.target
                                .value as (typeof REMINDER_OPTIONS)[number],
                            )
                          }
                          className="w-full cursor-pointer appearance-none rounded-2xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm text-gray-900 focus:border-[#3d8c40]/50 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/15"
                        >
                          {REMINDER_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                          aria-hidden
                        />
                      </div>
                      <div className="relative">
                        <select
                          value={reminderSecondary}
                          onChange={(e) =>
                            setReminderSecondary(
                              e.target
                                .value as (typeof REMINDER_OPTIONS)[number],
                            )
                          }
                          className="w-full cursor-pointer appearance-none rounded-2xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm text-gray-900 focus:border-[#3d8c40]/50 focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/15"
                        >
                          {REMINDER_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                {scheduleBlockedNoGoogleCalendar ? (
                  <div
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                    role="status"
                  >
                    This tutor has not connected their Google Calendar. They must
                    do this in their Tutor Settings before you can schedule a
                    class with a Google Meet link.
                  </div>
                ) : null}
                <div className="flex gap-3 rounded-xl border border-emerald-200/90 bg-[#F1FBF3] px-4 py-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#388E3C]">
                    <Check
                      className="h-5 w-5 text-white"
                      strokeWidth={2.75}
                    />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-bold text-slate-900">Ready to Schedule</p>
                    <p className="mt-0.5 text-sm leading-snug text-gray-600">
                      Review the details below and confirm to create the class
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-100/80 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
                    Students
                    {studentCount > 1
                      ? " (Group Class)"
                      : studentCount === 1
                        ? " (Individual Class)"
                        : ""}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {selectedStudents.length === 0 ? (
                      <li className="text-sm text-gray-500">—</li>
                    ) : (
                      selectedStudents.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-3"
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${s.avatarClass}`}
                          >
                            {s.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900">{s.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatLevelLabel(s.level)}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm text-gray-500">
                            {s.sessionsLeft} left
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="rounded-xl bg-slate-100/80 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
                    Tutor
                  </p>
                  {tutor ? (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                        {tutor.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{tutor.name}</p>
                        <p className="text-sm text-gray-500">
                          {tutor.specialty}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">—</p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-100/80 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
                    Schedule
                  </p>
                  <div className="mt-3 flex gap-3">
                    {classType === "recurring" ? (
                      <RefreshCw
                        className="mt-0.5 h-5 w-5 shrink-0 text-gray-400"
                        strokeWidth={2}
                      />
                    ) : (
                      <Calendar
                        className="mt-0.5 h-5 w-5 shrink-0 text-gray-400"
                        strokeWidth={2}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">
                        {classType === "recurring"
                          ? "Recurring Class"
                          : classType === "one-time"
                            ? "One-time Class"
                            : "Class"}
                      </p>
                      {scheduleDays.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {scheduleDays.map((d) => (
                            <span
                              key={d}
                              className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-semibold text-[#2E7D32]"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-sm text-gray-500">
                        {scheduleStartTime && scheduleEndTime
                          ? `${scheduleStartTime} - ${scheduleEndTime} · ${formatReviewUntilSuffix(durationMode, endsOnDateText, sessionCount)}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200/80 hover:text-gray-900"
            >
              {step === 0 ? (
                <>
                  <X className="h-4 w-4" strokeWidth={2} />
                  Cancel
                </>
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  Back
                </>
              )}
            </button>
            <button
              type="button"
              disabled={
                !canContinue() ||
                (step === reviewStepIndex && scheduleBlockedNoGoogleCalendar)
              }
              onClick={handlePrimary}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
                canContinue() &&
                !(step === reviewStepIndex && scheduleBlockedNoGoogleCalendar)
                  ? step === STEP_LABELS.length - 1
                    ? "bg-[#388E3C] text-white hover:bg-[#2E7D32]"
                    : "bg-[#2d6a32] text-white hover:bg-[#245528]"
                  : "cursor-not-allowed bg-gray-200 text-gray-500"
              }`}
            >
              {step === 0
                ? primaryLabelStep0
                : step === 1
                  ? primaryLabelStep1
                  : step === 2
                    ? primaryLabelStep2
                    : step === 3
                      ? primaryLabelStep3
                      : step === STEP_LABELS.length - 1
                        ? "Confirm & Schedule"
                        : "Continue"}
              {step === 0 && hasStudentSelection ? (
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              ) : null}
              {step === 1 && tutorId ? (
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              ) : null}
              {step === 2 && classType ? (
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              ) : null}
              {step === 3 && scheduleStepComplete ? (
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              ) : null}
              {step === STEP_LABELS.length - 1 ? (
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
