/**
 * Client-side persistence for completed Free Talk grading sessions.
 * Keyed per learner in localStorage — see product docs / PR summary for server sync tradeoffs.
 */

export type FreeTalkGradedBehaviour = {
  id: number;
  name: string;
  result: "full" | "partial" | "none";
  score: number;
};

export type FreeTalkGradeResult = {
  overallScore: number;
  competencyLevel: string;
  behaviours: FreeTalkGradedBehaviour[];
  rawScore: number;
  maxScore: number;
};

export type FreeTalkHistoryEntryV1 = {
  v: 1;
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioType: string;
  completedAt: string;
  feedbackText: string;
  gradeResult: FreeTalkGradeResult | null;
};

const STORAGE_PREFIX = "eklana-free-talk-history:v1:";

function keyForUser(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function safeParse(raw: string | null): FreeTalkHistoryEntryV1[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is FreeTalkHistoryEntryV1 =>
        row &&
        typeof row === "object" &&
        (row as FreeTalkHistoryEntryV1).v === 1 &&
        typeof (row as FreeTalkHistoryEntryV1).id === "string" &&
        typeof (row as FreeTalkHistoryEntryV1).scenarioId === "string"
    );
  } catch {
    return [];
  }
}

export function loadFreeTalkHistory(userId: string): FreeTalkHistoryEntryV1[] {
  if (typeof window === "undefined" || !userId) return [];
  const rows = safeParse(window.localStorage.getItem(keyForUser(userId)));
  return rows.sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}

export function appendFreeTalkHistoryEntry(
  userId: string,
  entry: Omit<FreeTalkHistoryEntryV1, "v" | "id" | "completedAt"> & {
    completedAt?: string;
  }
): void {
  if (typeof window === "undefined" || !userId) return;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const row: FreeTalkHistoryEntryV1 = {
    v: 1,
    id,
    completedAt: entry.completedAt ?? new Date().toISOString(),
    scenarioId: entry.scenarioId,
    scenarioTitle: entry.scenarioTitle,
    scenarioType: entry.scenarioType,
    feedbackText: entry.feedbackText,
    gradeResult: entry.gradeResult,
  };
  const k = keyForUser(userId);
  const prev = safeParse(window.localStorage.getItem(k));
  window.localStorage.setItem(k, JSON.stringify([row, ...prev]));
}
