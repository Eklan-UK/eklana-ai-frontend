export type ClassStatus = "active" | "completed" | "upcoming";
export type ClassType = "group" | "individual";

export interface ClassDrawerParticipant {
  initials: string;
  name: string;
  role: "Student" | "Tutor";
}

/** Optional overrides for the session detail drawer (merged with sensible defaults). */
export interface ClassDrawerDetailPartial {
  sessionNumber?: number;
  sessionTotal?: number;
  sessionDateLong?: string;
  sessionTimeRange?: string;
  recurring?: boolean;
  meetingUrl?: string;
  blockCompleted?: number;
  blockTotal?: number;
  nextSessionFull?: string;
  participants?: ClassDrawerParticipant[];
}

export interface TeachingClass {
  id: string;
  /** Class series title when provided by API. */
  title?: string;
  studentLabel: string;
  extraStudents: number;
  tutorName: string;
  classType: ClassType;
  participants: { initials: string }[];
  scheduleDays: string;
  timeRange: string;
  completedSessions: number;
  totalSessions: number;
  nextSessionLabel: string;
  /** Present when the list API includes the next session id (e.g. learner links). */
  nextSessionId?: string;
  status: ClassStatus;
  bucket: "today" | "upcoming";
  /** Set when API allows join (e.g. tutor list within join window). */
  meetingUrl?: string;
  drawer?: ClassDrawerDetailPartial;
}

export interface ClassDrawerDetailResolved {
  sessionNumber: number;
  sessionTotal: number;
  sessionDateLong: string;
  sessionTimeRange: string;
  recurring: boolean;
  meetingUrl: string;
  blockCompleted: number;
  blockTotal: number;
  nextSessionFull: string;
  participants: ClassDrawerParticipant[];
}

export function mergeClassDrawerDetail(s: TeachingClass): ClassDrawerDetailResolved {
  const d = s.drawer ?? {};
  const participantFallback = (): ClassDrawerParticipant[] => {
    const students = s.participants.map((p) => ({
      initials: p.initials,
      name: `${p.initials} · Student`,
      role: "Student" as const,
    }));
    const ti = s.tutorName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return [
      ...students,
      { initials: ti || "TU", name: s.tutorName, role: "Tutor" as const },
    ];
  };

  const blockTotal = d.blockTotal ?? s.totalSessions;
  const blockCompleted = Math.min(
    d.blockCompleted ?? s.completedSessions,
    blockTotal,
  );
  const sessionTotal = d.sessionTotal ?? blockTotal;
  const sessionNumber =
    d.sessionNumber ??
    (s.status === "completed"
      ? sessionTotal
      : Math.min(blockCompleted + 1, sessionTotal));

  return {
    sessionNumber,
    sessionTotal,
    sessionDateLong:
      d.sessionDateLong ??
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    sessionTimeRange: d.sessionTimeRange ?? s.timeRange.replace(/\u2013/g, "-"),
    recurring: d.recurring ?? true,
    meetingUrl: d.meetingUrl ?? `https://meet.eklan.ai/session-${s.id}`,
    blockCompleted,
    blockTotal,
    nextSessionFull:
      d.nextSessionFull ??
      `${s.nextSessionLabel} - ${s.timeRange.split(/\u2013/)[0]?.trim() ?? ""}`,
    participants: d.participants?.length ? d.participants : participantFallback(),
  };
}
