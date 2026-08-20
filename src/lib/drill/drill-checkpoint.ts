import { drillAPI } from '@/lib/api';

export type DrillCheckpointType =
  | 'vocabulary'
  | 'pronunciation'
  | 'matching'
  | 'definition'
  | 'grammar'
  | 'sentence'
  | 'sentence_writing'
  | 'fill_blank'
  | 'key_phrases'
  | 'listening'
  | 'summary';

export interface DrillCheckpointPayload {
  assignmentId: string;
  drillType: DrillCheckpointType;
  resumeFromIndex: number;
  completedItemCount: number;
  partialResults: Record<string, unknown>;
  startedAt?: string | Date;
}

export interface DrillCheckpointData {
  _id: string;
  drillId: string;
  drillAssignmentId: string;
  drillType: DrillCheckpointType;
  resumeFromIndex: number;
  completedItemCount: number;
  partialResults: Record<string, unknown>;
  startedAt: string;
  lastUpdatedAt: string;
}

export async function saveCheckpoint(
  drillId: string,
  payload: DrillCheckpointPayload,
): Promise<void> {
  await drillAPI.saveCheckpoint(drillId, payload);
}

/**
 * Listening/summary have no item checkpoints. POST a started marker so the
 * assignment flips to in-progress the same way other types do on first save.
 */
export async function markAssignedDrillInProgress(
  drillId: string,
  assignmentId: string | undefined,
  drillType: 'listening' | 'summary',
  startedAt?: string | Date,
): Promise<void> {
  if (!assignmentId) return;
  try {
    await saveCheckpoint(drillId, {
      assignmentId,
      drillType,
      resumeFromIndex: 0,
      completedItemCount: 0,
      partialResults: { started: true },
      startedAt,
    });
  } catch {
    // Best-effort: starting the drill must not fail if the status write fails.
  }
}

export async function loadCheckpoint(
  drillId: string,
  assignmentId: string,
): Promise<DrillCheckpointData | null> {
  try {
    const res = await drillAPI.getCheckpoint(drillId, assignmentId);
    return (res.data?.checkpoint as DrillCheckpointData | null) ?? null;
  } catch {
    return null;
  }
}

export async function clearCheckpoint(
  drillId: string,
  assignmentId: string,
): Promise<void> {
  try {
    await drillAPI.clearCheckpoint(drillId, assignmentId);
  } catch {
    // Ignore errors on cleanup — non-critical
  }
}
