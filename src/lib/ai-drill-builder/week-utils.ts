export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getAnchorTimestamp(
  subscriptionActivatedAt?: string | Date | null,
  createdAt?: string | Date | null,
): number {
  const anchor = subscriptionActivatedAt ?? createdAt ?? new Date();
  return new Date(anchor).getTime();
}

export function computeCurrentWeek(
  anchorDate?: string | Date | null,
  fallbackCreatedAt?: string | Date | null,
): number {
  const anchor = getAnchorTimestamp(anchorDate, fallbackCreatedAt);
  return Math.max(1, Math.ceil((Date.now() - anchor) / WEEK_MS));
}

/**
 * assignedAt that buckets into `weekNumber` with the existing
 * `ceil((assignedAt - anchor) / WEEK_MS)` formula (min 1).
 * Week 1 uses anchor+1ms so the value is strictly after the anchor.
 */
export function getAssignedAtForWeek(
  weekNumber: number,
  anchorDate?: string | Date | null,
  fallbackCreatedAt?: string | Date | null,
): Date {
  const anchor = getAnchorTimestamp(anchorDate, fallbackCreatedAt);
  const safeWeek = Math.max(1, Math.floor(weekNumber));
  return new Date(anchor + (safeWeek - 1) * WEEK_MS + 1);
}

export function getWeekDateRange(
  weekNumber: number,
  anchorDate?: string | Date | null,
  fallbackCreatedAt?: string | Date | null,
): { weekStartDate: Date; weekEndDate: Date } {
  const anchor = getAnchorTimestamp(anchorDate, fallbackCreatedAt);
  const weekStartDate = new Date(anchor + (weekNumber - 1) * WEEK_MS);
  const weekEndDate = new Date(anchor + weekNumber * WEEK_MS - 1);
  return { weekStartDate, weekEndDate };
}

export function formatWeekDateRange(
  weekNumber: number,
  anchorDate?: string | Date | null,
  fallbackCreatedAt?: string | Date | null,
): string {
  const { weekStartDate, weekEndDate } = getWeekDateRange(
    weekNumber,
    anchorDate,
    fallbackCreatedAt,
  );
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${fmt.format(weekStartDate)} – ${fmt.format(weekEndDate)}`;
}

export function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getWeekCompletionDate(
  weekNumber: number,
  anchorDate?: string | Date | null,
  fallbackCreatedAt?: string | Date | null,
): string {
  const { weekEndDate } = getWeekDateRange(
    weekNumber,
    anchorDate,
    fallbackCreatedAt,
  );
  return formatDateForInput(weekEndDate);
}

export interface WeekDrillItem {
  assignmentId?: string;
  drillId?: string | null;
  title?: string | null;
  type?: string | null;
  drillType?: string | null;
  difficulty?: string | null;
  topic?: string | null;
  part?: string | null;
  status?: string;
  /**
   * Whether the underlying drill is active. `false` means the drill was
   * saved (e.g. via "Save Drill") but still needs a tutor/admin to select
   * users and update/assign it.
   */
  isActive?: boolean;
  /** Admin library bookmark on the underlying drill. */
  isBookmarked?: boolean;
  assignedAt?: string;
  dueDate?: string | null;
  completedAt?: string | null;
}

export interface StudentWeek {
  weekNumber: number;
  weekStartDate?: string;
  weekEndDate?: string;
  drills?: WeekDrillItem[];
  items?: WeekDrillItem[];
}

export function mergeWeeksWithEmptySlots(
  weeks: StudentWeek[],
  currentWeek: number,
  anchorDate?: string | Date | null,
  fallbackCreatedAt?: string | Date | null,
): StudentWeek[] {
  const weekMap = new Map<number, StudentWeek>();
  for (const week of weeks) {
    weekMap.set(week.weekNumber, week);
  }

  const merged: StudentWeek[] = [];
  for (let w = 1; w <= currentWeek; w++) {
    const existing = weekMap.get(w);
    const { weekStartDate, weekEndDate } = getWeekDateRange(
      w,
      anchorDate,
      fallbackCreatedAt,
    );
    const drills = existing?.drills ?? existing?.items ?? [];
    merged.push({
      weekNumber: w,
      weekStartDate:
        existing?.weekStartDate ?? weekStartDate.toISOString(),
      weekEndDate: existing?.weekEndDate ?? weekEndDate.toISOString(),
      drills,
      items: drills,
    });
  }
  return merged;
}

export function composeStudentContextString(context: {
  professionalRole?: string;
  hospitalUnit?: string;
  country?: string;
}): string {
  const role = context.professionalRole?.trim();
  const unit = context.hospitalUnit?.trim();
  const country = context.country?.trim();
  if (role && unit && country) {
    return `${role} at ${unit}, ${country}`;
  }
  if (role && unit) {
    return `${role} at ${unit}`;
  }
  return role ?? unit ?? country ?? "";
}
