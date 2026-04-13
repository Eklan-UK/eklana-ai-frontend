import {
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";
import type { TeachingClass } from "@/app/(admin)/admin/classes/types";

export type MySessionsTab = "thisWeek" | "upcoming" | "past";

const WEEK_OPTS = { weekStartsOn: 1 as const }; // Monday

export function parseSessionStartUtc(item: TeachingClass): Date | null {
  if (!item.nextSessionStartUtc) return null;
  try {
    return parseISO(item.nextSessionStartUtc);
  } catch {
    return null;
  }
}

/** Series-level row: assign to exactly one tab. */
export function tabForSessionRow(
  item: TeachingClass,
  now: Date = new Date(),
): MySessionsTab {
  if (item.status === "completed") {
    return "past";
  }

  const start = parseSessionStartUtc(item);
  if (!start) {
    return "upcoming";
  }

  const weekStart = startOfWeek(now, WEEK_OPTS);
  const weekEnd = endOfWeek(now, WEEK_OPTS);

  if (start > weekEnd) {
    return "upcoming";
  }

  if (isWithinInterval(start, { start: weekStart, end: weekEnd })) {
    return "thisWeek";
  }

  if (start < weekStart) {
    return "upcoming";
  }

  return "upcoming";
}

export function filterByTab(
  items: TeachingClass[],
  tab: MySessionsTab,
  now: Date = new Date(),
): TeachingClass[] {
  return items.filter((row) => tabForSessionRow(row, now) === tab);
}

export function formatSessionCardDate(
  iso: string | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (day.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  const wd = d.toLocaleDateString("en-US", { weekday: "short" });
  const rest = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffDays === 0) return `Today, ${rest}`;
  if (diffDays === 1) return `Tomorrow, ${rest}`;
  return `${wd}, ${rest}`;
}

export function relativeStartsIn(
  iso: string | undefined,
  now: Date = new Date(),
): string | null {
  if (!iso) return null;
  const start = parseISO(iso);
  const ms = start.getTime() - now.getTime();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const weeks = Math.floor(days / 7);
  if (weeks > 0) {
    return `Starts in ${weeks} wk${weeks === 1 ? "" : "s"}`;
  }
  if (days > 0) {
    return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (hrs > 0) {
    return `Starts in ${hrs} hr${hrs === 1 ? "" : "s"}`;
  }
  return `Starts in ${mins} min`;
}

export type SessionCardBadge =
  | "live"
  | "startsIn"
  | "upcoming"
  | "completed"
  | "missed";

export function resolveCardBadge(
  item: TeachingClass,
  now: Date = new Date(),
): { kind: SessionCardBadge; label: string } {
  if (item.status === "completed") {
    return { kind: "completed", label: "Completed" };
  }

  const start = parseSessionStartUtc(item);
  if (!start) {
    return { kind: "upcoming", label: "Upcoming" };
  }

  const endGuess = new Date(start.getTime() + 60 * 60 * 1000);
  if (now >= start && now <= endGuess && item.status === "active") {
    return { kind: "live", label: "Live now" };
  }
  if (now >= start && now <= endGuess) {
    return { kind: "live", label: "Live now" };
  }

  const rel = relativeStartsIn(item.nextSessionStartUtc, now);
  if (rel) {
    return { kind: "startsIn", label: rel };
  }

  return { kind: "upcoming", label: "Upcoming" };
}

export type JoinButtonVariant = "live" | "soon" | "ready" | "disabled";

export function joinButtonVariant(
  item: TeachingClass,
  canJoin: boolean,
  now: Date = new Date(),
): JoinButtonVariant {
  const start = parseSessionStartUtc(item);
  if (!start) return canJoin ? "ready" : "disabled";

  const endGuess = new Date(start.getTime() + 60 * 60 * 1000);
  const isLive = now >= start && now <= endGuess;

  if (isLive && canJoin) return "live";
  if (isLive && !canJoin) return "disabled";

  const ms = start.getTime() - now.getTime();
  const hrsUntil = ms / (60 * 60 * 1000);
  if (hrsUntil > 0 && hrsUntil <= 2) {
    return canJoin ? "soon" : "soon";
  }

  return canJoin ? "ready" : "disabled";
}
