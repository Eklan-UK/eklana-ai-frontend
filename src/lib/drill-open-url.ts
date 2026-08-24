/**
 * HTTPS bounce URL for drill-assignment email CTAs.
 * Opens /open/drill when both IDs are present; otherwise falls back to the drill list.
 */
export function buildDrillOpenUrl(
  appUrl: string,
  drillId?: string,
  assignmentId?: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  if (drillId && assignmentId) {
    const params = new URLSearchParams({ drillId, assignmentId });
    return `${base}/open/drill?${params.toString()}`;
  }
  return `${base}/account/drills`;
}

export function buildDrillAppDeepLink(
  drillId: string,
  assignmentId?: string,
): string {
  const path = `elkan://account/drills/${drillId}`;
  if (assignmentId) {
    return `${path}?assignmentId=${encodeURIComponent(assignmentId)}`;
  }
  return path;
}

export function buildDrillWebPath(
  drillId: string,
  assignmentId?: string,
): string {
  const path = `/account/drills/${drillId}`;
  if (assignmentId) {
    return `${path}?assignmentId=${encodeURIComponent(assignmentId)}`;
  }
  return path;
}

/**
 * Assignment id from GET /api/v1/drills/:id JSON
 * (`{ code, data: { drill, assignment: { assignmentId } } }`).
 * Word/expression bookmarks store only drillId; Practice recovers this
 * then navigates with buildDrillWebPath(drillId, assignmentId).
 */
export function assignmentIdFromGetDrillPayload(
  payload: unknown,
): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const assignment = nested.assignment;
  if (!assignment || typeof assignment !== "object") return undefined;
  const id = (assignment as { assignmentId?: unknown }).assignmentId;
  if (id == null) return undefined;
  const value = String(id).trim();
  return value.length > 0 ? value : undefined;
}

/**
 * Bookmark Practice path after GET /api/v1/drills/:id.
 * Null on 403/failed response or missing assignment — UI toasts and stays.
 */
export function bookmarkOpenPathAfterGet(
  drillId: string,
  responseOk: boolean,
  payload: unknown,
): string | null {
  if (!responseOk || !drillId) return null;
  const assignmentId = assignmentIdFromGetDrillPayload(payload);
  if (!assignmentId) return null;
  return buildDrillWebPath(drillId, assignmentId);
}

/**
 * My Plan / Learning Journey / DrillCard href.
 * Open Path rows must carry assignmentId so POST /complete can submit.
 * Completed rows go to View Results (no submit). DrillId-only URLs (old
 * emails / deep links) still recover on the drill page.
 */
export function buildLearnerDrillHref(
  drillId: string,
  assignmentId?: string | null,
  options?: { completed?: boolean },
): string {
  const id = String(drillId);
  const assignment =
    assignmentId != null && String(assignmentId).length > 0
      ? String(assignmentId)
      : undefined;
  if (options?.completed && assignment) {
    return `/account/drills/${id}/completed?assignmentId=${encodeURIComponent(assignment)}`;
  }
  return buildDrillWebPath(id, assignment);
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
}
