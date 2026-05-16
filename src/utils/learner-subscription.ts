/**
 * Pro access for learner UI (mirrors mobile `isProSubscriber` merge of flags).
 */
export function learnerHasProAccess(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as { isSubscribed?: boolean; subscriptionPlan?: string };
  if (u.isSubscribed === true) return true;
  return String(u.subscriptionPlan || "").toLowerCase() === "premium";
}
