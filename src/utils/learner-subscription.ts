/**
 * Pro access for learner UI — must match server isUserSubscribed / user.isSubscribed.
 */
export function learnerHasProAccess(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as { isSubscribed?: boolean };
  return u.isSubscribed === true;
}
