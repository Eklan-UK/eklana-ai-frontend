import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import type { DrillAssignment as AssignmentRow } from '@/domain/assignments/assignment.types';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';

/** Lean populated assignment from `findByLearnerId` (drillId is a drill document). */
type PopulatedLearnerAssignment = Omit<AssignmentRow, 'drillId' | 'assignedBy'> & {
  drillId: Record<string, unknown> & { _id?: Types.ObjectId; title?: string };
  assignedBy?: unknown;
};

export type LearnerMyDrillsPayload = {
  drills: Array<{
    assignmentId: Types.ObjectId;
    drill: unknown;
    assignedBy: unknown;
    assignedAt: Date;
    dueDate?: Date;
    status: string;
    completedAt?: Date | null;
    latestAttempt: {
      score: number;
      timeSpent?: number;
      completedAt?: Date;
      reviewStatus?: string;
      correctCount?: number;
      totalCount?: number;
    } | null;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type LearnerMyDrillRow = LearnerMyDrillsPayload['drills'][number];

/**
 * Same data as GET /api/v1/drills/learner/my-drills — used from RSC to avoid
 * loopback fetch (wrong origin / connection refused in dev).
 */
export async function getLearnerMyDrillsPayload(
  learnerId: Types.ObjectId,
  params: { status?: string; limit?: number; offset?: number }
): Promise<LearnerMyDrillsPayload> {
  await connectToDatabase();

  const assignmentRepo = new AssignmentRepository();
  const attemptRepo = new AttemptRepository();

  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const result = await assignmentRepo.findByLearnerId(learnerId.toString(), {
    status: params.status,
    limit,
    offset,
  });

  const assignmentIds = result.assignments.map((a: { _id: Types.ObjectId }) =>
    a._id.toString()
  );
  const attemptMap = await attemptRepo.getLatestAttemptsForAssignments(assignmentIds);

  const drills = (result.assignments as PopulatedLearnerAssignment[]).map((assignment) => {
    const attemptData = attemptMap.get(assignment._id.toString());
    return {
      assignmentId: assignment._id,
      drill: assignment.drillId,
      assignedBy: assignment.assignedBy,
      assignedAt: assignment.assignedAt,
      dueDate: assignment.dueDate,
      status: assignment.status,
      completedAt: assignment.completedAt,
      latestAttempt: attemptData
        ? {
            score: attemptData.score,
            timeSpent: attemptData.timeSpent,
            completedAt: attemptData.completedAt,
            reviewStatus: attemptData.reviewStatus,
            correctCount: attemptData.correctCount,
            totalCount: attemptData.totalCount,
          }
        : null,
    };
  });

  return {
    drills,
    pagination: {
      total: result.total,
      limit,
      offset,
      hasMore: offset + result.assignments.length < result.total,
    },
  };
}
