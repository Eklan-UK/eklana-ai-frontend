import { FREE_TALK_PLAN_ITEM_TYPE } from '@/lib/learner-assigned-plan.shared';

export function isFreeTalkPlanItem(item: {
  itemType?: string;
  drill?: { type?: string };
}): boolean {
  return (
    item.itemType === FREE_TALK_PLAN_ITEM_TYPE ||
    item.drill?.type === 'eklan_free_talk'
  );
}

export function freeTalkScenarioTypeLabel(scenarioType: string): string {
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
  return [...items].sort((a, b) => assignedPlanSortTime(b) - assignedPlanSortTime(a));
}
