export interface LearnerRecord {
  id?: string;
  _id?: string | { toString(): string };
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string | null;
  image?: string | null;
  subscriptionActivatedAt?: string | null;
  createdAt?: string | null;
}

/** Normalize Mongo/API learner id to a stable string for links and comparisons. */
export function getLearnerId(learner: LearnerRecord): string {
  const raw = learner.id ?? learner._id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object") {
    const str = raw.toString();
    if (str && str !== "[object Object]") return str;
  }
  return "";
}

export function getLearnerDisplayName(learner: LearnerRecord): string {
  const fromName = learner.name?.trim();
  if (fromName) return fromName;
  const fromParts = `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim();
  return fromParts || "Unknown";
}

/** Profile photo set by the learner (avatar upload or preset). */
export function getLearnerAvatarUrl(learner: LearnerRecord): string | null {
  const url = learner.avatar?.trim() || learner.image?.trim();
  return url || null;
}
