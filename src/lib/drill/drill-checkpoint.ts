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
  | 'key_phrases';

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
