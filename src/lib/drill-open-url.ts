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

export function isMobileUserAgent(userAgent: string): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
}
