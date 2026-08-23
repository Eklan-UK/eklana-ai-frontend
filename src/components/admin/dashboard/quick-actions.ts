export const QUICK_ACTIONS_STORAGE_KEY = "admin-dashboard-quick-actions";
export const QUICK_ACTIONS_CHANGE_EVENT = "admin-dashboard-quick-actions-changed";
export const QUICK_ACTIONS_VISIBLE_CAP = 5;

export type QuickActionId =
  | "create-drill"
  | "precision-clinic"
  | "create-class"
  | "discovery-calls"
  | "analytics"
  | "learners"
  | "classes"
  | "tutor"
  | "drill-builder"
  | "subscriptions"
  | "weekly-challenge"
  | "bookmark-drills";

export interface QuickActionItem {
  id: QuickActionId;
  label: string;
  href: string;
  iconSrc: string;
  iconBg: string;
  iconRounded: string;
}

const ICON_DIR = "/images/admin-dashboard";

export const QUICK_ACTION_CATALOG: QuickActionItem[] = [
  {
    id: "create-drill",
    label: "Create Drill",
    href: "/admin/drills/create",
    iconSrc: `${ICON_DIR}/qa-create-drill.svg`,
    iconBg: "bg-[#2a602c]",
    iconRounded: "rounded-[20px]",
  },
  {
    id: "precision-clinic",
    label: "Precision Clinic",
    href: "/admin/precision-clinic",
    iconSrc: `${ICON_DIR}/qa-precision-clinic.svg`,
    iconBg: "bg-[#e8f5f0]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "create-class",
    label: "Create Class",
    href: "/admin/classes?schedule=1",
    iconSrc: `${ICON_DIR}/qa-create-class.svg`,
    iconBg: "bg-[#eff6ff]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "discovery-calls",
    label: "Discovery Calls",
    href: "/admin/discovery-call",
    iconSrc: `${ICON_DIR}/qa-discovery-calls.svg`,
    iconBg: "bg-[#fff7ed]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/admin/analytics",
    iconSrc: `${ICON_DIR}/qa-analytics.svg`,
    iconBg: "bg-[#e8f5f2]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "learners",
    label: "Learners",
    href: "/admin/Learners",
    iconSrc: `${ICON_DIR}/qa-learners.svg`,
    iconBg: "bg-[#e8f5f2]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "classes",
    label: "Classes",
    href: "/admin/classes",
    iconSrc: `${ICON_DIR}/qa-classes.svg`,
    iconBg: "bg-[#eff6ff]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "tutor",
    label: "Tutor",
    href: "/admin/tutor",
    iconSrc: `${ICON_DIR}/qa-tutor.svg`,
    iconBg: "bg-[#fef3c7]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "drill-builder",
    label: "Drill Builder",
    href: "/admin/drills",
    iconSrc: `${ICON_DIR}/qa-drill-builder.svg`,
    iconBg: "bg-[#ede9fe]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    href: "/admin/subscriptions",
    iconSrc: `${ICON_DIR}/qa-subscriptions.svg`,
    iconBg: "bg-[#fef3c7]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "weekly-challenge",
    label: "Weekly Challenge",
    href: "/admin/weekly-challenge",
    iconSrc: `${ICON_DIR}/qa-weekly-challenge.svg`,
    iconBg: "bg-[#fff7ed]",
    iconRounded: "rounded-[10px]",
  },
  {
    id: "bookmark-drills",
    label: "Bookmark Drills",
    href: "/admin/drills/bookmarked",
    iconSrc: `${ICON_DIR}/qa-bookmark-drills.svg`,
    iconBg: "bg-[#fce7f3]",
    iconRounded: "rounded-[10px]",
  },
];

export const DEFAULT_QUICK_ACTION_IDS: QuickActionId[] = [
  "create-drill",
  "precision-clinic",
  "create-class",
  "discovery-calls",
  "analytics",
];

const CATALOG_BY_ID = new Map(
  QUICK_ACTION_CATALOG.map((item) => [item.id, item]),
);

export function isQuickActionId(value: unknown): value is QuickActionId {
  return typeof value === "string" && CATALOG_BY_ID.has(value as QuickActionId);
}

export function sanitizeQuickActionIds(ids: unknown): QuickActionId[] {
  if (!Array.isArray(ids)) return [...DEFAULT_QUICK_ACTION_IDS];

  const seen = new Set<QuickActionId>();
  const valid: QuickActionId[] = [];

  for (const id of ids) {
    if (!isQuickActionId(id) || seen.has(id)) continue;
    seen.add(id);
    valid.push(id);
    if (valid.length >= QUICK_ACTIONS_VISIBLE_CAP) break;
  }

  return valid.length > 0 ? valid : [...DEFAULT_QUICK_ACTION_IDS];
}

let snapshotRaw: string | null | undefined;
let snapshotIds: QuickActionId[] = DEFAULT_QUICK_ACTION_IDS;

export function loadQuickActionIds(): QuickActionId[] {
  if (typeof window === "undefined") return DEFAULT_QUICK_ACTION_IDS;

  try {
    const raw = localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
    if (raw === snapshotRaw) return snapshotIds;
    snapshotRaw = raw;
    if (!raw) {
      snapshotIds = DEFAULT_QUICK_ACTION_IDS;
      return snapshotIds;
    }
    const parsed = JSON.parse(raw) as { ids?: unknown };
    snapshotIds = sanitizeQuickActionIds(parsed?.ids);
    return snapshotIds;
  } catch {
    snapshotRaw = null;
    snapshotIds = DEFAULT_QUICK_ACTION_IDS;
    return snapshotIds;
  }
}

export function getQuickActionIdsServerSnapshot(): QuickActionId[] {
  return DEFAULT_QUICK_ACTION_IDS;
}

export function subscribeQuickActionIds(onStoreChange: () => void): () => void {
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(QUICK_ACTIONS_CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(QUICK_ACTIONS_CHANGE_EVENT, handler);
  };
}

export function saveQuickActionIds(ids: QuickActionId[]): void {
  if (typeof window === "undefined") return;

  try {
    const sanitized = sanitizeQuickActionIds(ids);
    const raw = JSON.stringify({ ids: sanitized });
    localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, raw);
    snapshotRaw = raw;
    snapshotIds = sanitized;
    window.dispatchEvent(new Event(QUICK_ACTIONS_CHANGE_EVENT));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function resolveQuickActions(ids: QuickActionId[]): QuickActionItem[] {
  return sanitizeQuickActionIds(ids)
    .map((id) => CATALOG_BY_ID.get(id))
    .filter((item): item is QuickActionItem => Boolean(item));
}
