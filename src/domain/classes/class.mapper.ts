import type {
  AdminClassListItemDTO,
  AdminClassDetailDTO,
  ClassBucket,
  ApiClassStatus,
} from './class.api.types';
import type { IClassSeries } from '@/models/class-series';
import type { IClassSession } from '@/models/class-session';
import type { IUser } from '@/models/user';

function dateKeyInTz(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-CA', { timeZone });
}

export function computeBucket(nextSessionStart: Date, timeZone: string): ClassBucket {
  const now = new Date();
  const kNow = dateKeyInTz(now, timeZone);
  const kStart = dateKeyInTz(nextSessionStart, timeZone);
  return kNow === kStart ? 'today' : 'upcoming';
}

function formatScheduleDaysFromLabels(labels: string[]): string {
  if (labels.length === 0) return '—';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

function userDisplayName(u: Pick<IUser, 'firstName' | 'lastName' | 'email'>): string {
  const n = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return n || u.email;
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function formatNextSessionLabel(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Minutes before session start when join URL may be revealed (Phase 2). */
export const TUTOR_JOIN_EARLY_MINUTES = 15;

export function getNextSessionForList(sessions: IClassSession[]): IClassSession | null {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
  );
  return (
    sorted.find((s) => s.status !== 'cancelled' && new Date(s.endUtc) >= new Date()) ??
    sorted.filter((s) => s.status !== 'cancelled').slice(-1)[0] ??
    null
  );
}

/** Whether the tutor may see/use meetingUrl for this session (join window). */
export function tutorMeetingUrlAllowed(
  next: IClassSession | null,
  now: Date = new Date(),
): boolean {
  if (!next?.meetingUrl) return false;
  if (next.status === 'in_progress') return true;
  const start = new Date(next.startUtc).getTime();
  const end = new Date(next.endUtc).getTime();
  const t = now.getTime();
  const earlyMs = TUTOR_JOIN_EARLY_MINUTES * 60 * 1000;
  return t >= start - earlyMs && t <= end;
}

/** Strip meeting URLs from list row when outside join window (tutor API). */
export function applyTutorJoinPolicy(
  item: AdminClassListItemDTO,
  nextSession: IClassSession | null,
  now: Date = new Date(),
): AdminClassListItemDTO {
  const allow = tutorMeetingUrlAllowed(nextSession, now);
  if (allow) return item;
  return {
    ...item,
    meetingUrl: undefined,
    drawer: item.drawer
      ? { ...item.drawer, meetingUrl: undefined }
      : undefined,
  };
}

function deriveStatus(
  sessions: Pick<IClassSession, 'startUtc' | 'endUtc' | 'status'>[],
  next: IClassSession | null,
  totalPlanned: number,
): ApiClassStatus {
  const nonCancelled = sessions.filter((s) => s.status !== 'cancelled');
  if (
    nonCancelled.length > 0 &&
    nonCancelled.every((s) => s.status === 'completed')
  ) {
    return 'completed';
  }
  const completed = sessions.filter((s) => s.status === 'completed').length;
  if (completed >= totalPlanned && totalPlanned > 0) {
    return 'completed';
  }
  const now = new Date();
  if (next) {
    if (next.status === 'in_progress') return 'active';
    if (now >= new Date(next.startUtc) && now <= new Date(next.endUtc)) {
      return 'active';
    }
  }
  return 'upcoming';
}

export function mapSeriesToListItem(
  series: IClassSeries,
  sessions: IClassSession[],
  learnerUsers: IUser[],
  tutorUser: IUser,
): AdminClassListItemDTO {
  const tz = series.timezone || 'UTC';
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
  );
  const next = getNextSessionForList(sessions);

  const completedSessions = sorted.filter((s) => s.status === 'completed').length;
  const totalSessions = series.totalSessionsPlanned || sorted.length || 1;

  const primary = learnerUsers[0];
  const studentLabel = primary ? userDisplayName(primary) : 'Class';
  const participants = learnerUsers.map((u) => ({
    initials: initialsFromName(userDisplayName(u)),
    userId: u._id.toString(),
  }));

  const scheduleDays = formatScheduleDaysFromLabels(series.scheduleDayLabels || []);
  const trStart = series.scheduleStartTime || '';
  const trEnd = series.scheduleEndTime || '';
  const timeRange =
    trStart && trEnd ? `${trStart} – ${trEnd}` : '—';

  const nextSessionLabel = next
    ? formatNextSessionLabel(new Date(next.startUtc), tz)
    : '—';

  const bucket: ClassBucket = next
    ? computeBucket(new Date(next.startUtc), tz)
    : 'upcoming';

  const status = deriveStatus(sorted, next, totalSessions);

  return {
    id: series._id.toString(),
    title: series.title?.trim() || undefined,
    studentLabel,
    extraStudents: Math.max(0, learnerUsers.length - 1),
    tutorName: userDisplayName(tutorUser),
    tutorId: series.tutorId.toString(),
    classType: series.classType,
    participants,
    scheduleDays,
    timeRange,
    completedSessions,
    totalSessions,
    nextSessionLabel,
    nextSessionId: next?._id.toString(),
    nextSessionStartUtc: next ? new Date(next.startUtc).toISOString() : undefined,
    status,
    bucket,
    meetingUrl: next?.meetingUrl,
    drawer: {
      recurring: series.recurrenceRule === 'weekly',
      sessionTimeRange:
        trStart && trEnd ? `${trStart} - ${trEnd}` : undefined,
      sessionNumber: Math.min(completedSessions + 1, totalSessions),
      sessionTotal: totalSessions,
      blockCompleted: completedSessions,
      blockTotal: totalSessions,
      meetingUrl: next?.meetingUrl,
    },
  };
}

export function mapToAdminDetail(
  series: IClassSeries,
  sessions: IClassSession[],
  learnerUsers: IUser[],
  tutorUser: IUser,
): AdminClassDetailDTO {
  const list = mapSeriesToListItem(series, sessions, learnerUsers, tutorUser);
  const enrollments = learnerUsers.map((u) => ({
    learnerId: u._id.toString(),
    displayName: userDisplayName(u),
    initials: initialsFromName(userDisplayName(u)),
  }));
  const sess = [...sessions]
    .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime())
    .map((s) => ({
      id: s._id.toString(),
      startUtc: new Date(s.startUtc).toISOString(),
      endUtc: new Date(s.endUtc).toISOString(),
      status: s.status,
      meetingUrl: s.meetingUrl,
    }));

  return {
    id: series._id.toString(),
    series: {
      id: series._id.toString(),
      title: series.title,
      tutorId: series.tutorId.toString(),
      tutorName: userDisplayName(tutorUser),
      classType: series.classType,
      timezone: series.timezone,
    },
    enrollments,
    sessions: sess,
    drawerDefaults: list.drawer,
  };
}
