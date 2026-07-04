export type DrillAssignmentStatus = "all" | "saved" | "assigned";

export type DrillListFilters = {
  q: string;
  student: string;
  type: string;
  status: DrillAssignmentStatus;
  offset: number;
};

export const DEFAULT_DRILL_LIST_FILTERS: DrillListFilters = {
  q: "",
  student: "",
  type: "all",
  status: "all",
  offset: 0,
};

const ALLOWED_RETURN_PREFIXES = [
  "/admin/drill",
  "/admin/drills",
  "/admin/ai-drill-builder",
  "/admin/ai-user-builder",
  "/admin/learners",
  "/tutor/drills",
  "/tutor/drills/all",
  "/tutor/ai-drill-builder",
  "/tutor/ai-user-builder",
  "/tutor/students",
] as const;

function parseOffset(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseStatus(value: string | null): DrillAssignmentStatus {
  if (value === "saved" || value === "assigned") return value;
  return "all";
}

export function parseDrillListFilters(
  searchParams: Pick<URLSearchParams, "get">
): DrillListFilters {
  return {
    q: searchParams.get("q") ?? "",
    student: searchParams.get("student") ?? "",
    type: searchParams.get("type") ?? "all",
    status: parseStatus(searchParams.get("status")),
    offset: parseOffset(searchParams.get("offset")),
  };
}

export function hasActiveDrillListFilters(filters: DrillListFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.student.trim().length > 0 ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.offset > 0
  );
}

export function buildDrillListQueryString(filters: DrillListFilters): string {
  const params = new URLSearchParams();

  const q = filters.q.trim();
  if (q) params.set("q", q);

  const student = filters.student.trim();
  if (student) params.set("student", student);

  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.offset > 0) params.set("offset", String(filters.offset));

  return params.toString();
}

export function buildDrillListPath(
  basePath: string,
  filters: DrillListFilters
): string {
  const qs = buildDrillListQueryString(filters);
  return qs ? `${basePath}?${qs}` : basePath;
}

export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;

  const allowed = ALLOWED_RETURN_PREFIXES.some(
    (prefix) =>
      decoded === prefix ||
      decoded.startsWith(`${prefix}/`) ||
      decoded.startsWith(`${prefix}?`),
  );
  if (!allowed) return null;

  return decoded;
}

// NOTE: returns the raw (unencoded) path. `appendReturnTo` is responsible for
// URI-encoding it when embedding it into another URL's query string - this
// keeps every producer/consumer of a "returnTo" value working with plain,
// decoded paths (matching what `searchParams.get("returnTo")` already gives
// you) instead of some callers holding encoded values and others decoded.
export function buildReturnToQueryParam(filters: DrillListFilters, basePath: string): string {
  return buildDrillListPath(basePath, filters);
}

export function appendReturnTo(href: string, returnTo: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
