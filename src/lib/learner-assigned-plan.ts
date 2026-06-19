import { FREE_TALK_PLAN_ITEM_TYPE } from '@/lib/learner-assigned-plan.shared';
import { FREE_TALK_SCENARIO_TYPE_LABELS } from '@/models/free-talk-scenario.shared';
import { getDrillStatus } from '@/utils/drill';

export type PlanTab = 'ongoing' | 'completed' | 'bookmarked';

export function isFreeTalkPlanItem(item: {
  itemType?: string;
  drill?: { type?: string };
}): boolean {
  return (
    item.itemType === FREE_TALK_PLAN_ITEM_TYPE ||
    item.drill?.type === 'eklan_free_talk'
  );
}

export function isCompletedPlanItem(item: {
  itemType?: string;
  drill?: { type?: string; date?: string | Date | null };
  completedAt?: string | Date | null;
  status?: string;
  assignmentStatus?: string;
  dueDate?: string | Date;
  latestAttempt?: {
    completedAt?: string | Date | null;
    reviewStatus?: string;
  } | null;
}): boolean {
  if (isFreeTalkPlanItem(item)) {
    return Boolean(item.completedAt) || item.status === 'completed';
  }
  return (
    getDrillStatus({
      ...item,
      assignmentStatus: item.assignmentStatus ?? item.status,
    }) === 'completed'
  );
}

/** Non-completed drills shown on the home "Assigned Drills" section. */
export function isActiveAssignedPlanItem(item: {
  itemType?: string;
  drill?: { type?: string; date?: string | Date | null };
  completedAt?: string | Date | null;
  status?: string;
  assignmentStatus?: string;
  dueDate?: string | Date;
  latestAttempt?: {
    completedAt?: string | Date | null;
    reviewStatus?: string;
  } | null;
}): boolean {
  return !isCompletedPlanItem(item);
}

/** Tab bucket for My Plan (Ongoing / Completed / Bookmarked). */
export function drillPlanTab(item: {
  itemType?: string;
  drill?: { type?: string; date: string; _id?: string };
  completedAt?: string | Date | null;
  status?: string;
  assignmentStatus?: string;
  dueDate?: string;
  hasBookmarks?: boolean;
  latestAttempt?: { completedAt?: string | Date | null; reviewStatus?: 'pending' | 'reviewed' };
}): PlanTab {
  if (item.hasBookmarks) return 'bookmarked';
  if (!isCompletedPlanItem(item)) return 'ongoing';
  return 'completed';
}

export function freeTalkScenarioTypeLabel(scenarioType: string): string {
  const label = FREE_TALK_SCENARIO_TYPE_LABELS[scenarioType as keyof typeof FREE_TALK_SCENARIO_TYPE_LABELS];
  if (label) return label;
  const t = scenarioType.replace(/_/g, ' ').trim();
  if (!t) return 'Eklan Free Talk';
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function assignedPlanSortTime(item: {
  assignedAt?: string | Date | null;
  drill?: { date?: string | Date | null };
}): number {
  const raw = item.assignedAt ?? item.drill?.date ?? 0;
  const d = new Date(raw as string | Date);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function sortAssignedPlanItems<T extends { assignedAt?: string | Date | null; drill?: { date?: string | Date | null } }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => assignedPlanSortTime(a) - assignedPlanSortTime(b));
}

export function isInProgressPlanItem(item: { status?: string }): boolean {
  return item.status === 'in-progress' || item.status === 'in_progress';
}

type ActivePlanItem = Parameters<typeof isActiveAssignedPlanItem>[0] & {
  assignedAt?: string | Date | null;
  drill?: { date?: string | Date | null };
  status?: string;
};

/** Next drill for Start/Continue Practice: resume in-progress, else oldest incomplete assignment. */
export function pickNextPracticeDrill<T extends ActivePlanItem>(items: T[]): T | undefined {
  const active = sortAssignedPlanItems(items.filter(isActiveAssignedPlanItem));
  return active.find(isInProgressPlanItem) ?? active[0];
}
