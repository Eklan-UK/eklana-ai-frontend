import type {
  AdminClassListItemDTO,
  ClassBucket,
} from "@/domain/classes/class.api.types";

type ClassListPagination = {
  total: number;
  limit: number;
  offset: number;
  hasMore?: boolean;
};

type ClassListPageData = {
  classes: AdminClassListItemDTO[];
  pagination?: ClassListPagination;
};

function formatTimeLabel(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function hasClassesArray(value: unknown): value is ClassListPageData {
  return isRecord(value) && Array.isArray(value.classes);
}

function patchClassListPage(
  page: ClassListPageData,
  classSeriesId: string,
  newStartUtc: string,
  nextSessionLabel: string,
  timeRange: string,
  scheduleDays: string,
  bucket: ClassBucket,
): ClassListPageData {
  return {
    ...page,
    classes: page.classes.map((row) => {
      if (row.id !== classSeriesId) return row;
      const sessionTimeRange = timeRange.replace(" – ", " - ");
      const drawer = row.drawer
        ? {
            ...row.drawer,
            sessionTimeRange,
            nextSessionFull: nextSessionLabel,
          }
        : { nextSessionFull: nextSessionLabel, sessionTimeRange };
      return {
        ...row,
        nextSessionStartUtc: newStartUtc,
        nextSessionIsReschedule: true,
        nextSessionLabel,
        timeRange,
        scheduleDays,
        bucket,
        drawer,
      };
    }),
  };
}

/**
 * Patch cached class list data after a successful reschedule.
 * Supports flat `{ classes }` pages and infinite `{ pages: [{ classes }] }`
 * React Query shapes. Unknown shapes are returned unchanged (never throws).
 */
export function patchClassListDataOnReschedule<T>(
  old: T,
  classSeriesId: string,
  newStartUtc: string,
  newEndUtc: string,
): T {
  if (!isRecord(old)) return old;

  const start = new Date(newStartUtc);
  const end = new Date(newEndUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return old;

  const nextSessionLabel = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeRange = `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
  const scheduleDays = start.toLocaleDateString("en-US", { weekday: "long" });

  const now = new Date();
  const isToday =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();
  const bucket: ClassBucket = isToday ? "today" : "upcoming";

  const patchPage = (page: unknown) => {
    if (!hasClassesArray(page)) return page;
    return patchClassListPage(
      page,
      classSeriesId,
      newStartUtc,
      nextSessionLabel,
      timeRange,
      scheduleDays,
      bucket,
    );
  };

  if (Array.isArray(old.pages)) {
    return {
      ...old,
      pages: old.pages.map(patchPage),
    } as T;
  }

  if (hasClassesArray(old)) {
    return patchPage(old) as T;
  }

  return old;
}
