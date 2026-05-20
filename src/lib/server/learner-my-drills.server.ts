import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import type { DrillAssignment as AssignmentRow } from '@/domain/assignments/assignment.types';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';
import FreeTalkScenario from '@/models/free-talk-scenario';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import { freeTalkScenarioLearnerFilter } from '@/lib/free-talk-scenario-assignment';
import { purgeExpiredFreeTalkScenarios } from '@/lib/free-talk-scenario-purge';

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

import { FREE_TALK_PLAN_ITEM_TYPE } from '@/lib/learner-assigned-plan.shared';

export type LearnerFreeTalkPlanRow = LearnerMyDrillRow & {
	itemType: typeof FREE_TALK_PLAN_ITEM_TYPE;
};

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

  // Repository types drillId as ObjectId; lean+populate returns a drill subdocument at runtime.
  const populated = result.assignments as unknown as PopulatedLearnerAssignment[];
  const drills = populated.map((assignment) => {
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

  await purgeExpiredFreeTalkScenarios();

  const scenarioRows = await FreeTalkScenario.find(freeTalkScenarioLearnerFilter(learnerId))
    .sort({ createdAt: -1 })
    .select({ title: 1, scenarioType: 1, createdAt: 1, completionDate: 1 })
    .lean()
    .exec();

  const scenarioIds = scenarioRows.map((doc) => String(doc._id));
  const attemptRows =
    scenarioIds.length > 0
      ? await FreeTalkAttempt.find({
          learnerId,
          scenarioId: { $in: scenarioIds },
        })
          .select({ scenarioId: 1, createdAt: 1 })
          .sort({ createdAt: -1 })
          .lean()
          .exec()
      : [];

  const latestAttemptByScenario = new Map<string, Date>();
  for (const row of attemptRows) {
    const sid = String(row.scenarioId);
    if (!latestAttemptByScenario.has(sid)) {
      latestAttemptByScenario.set(
        sid,
        row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      );
    }
  }

  const freeTalkDrills: LearnerFreeTalkPlanRow[] = scenarioRows.map((doc) => {
    const createdAt = doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt);
    const id = doc._id as Types.ObjectId;
    const idStr = String(id);
    const completionDate =
      doc.completionDate instanceof Date
        ? doc.completionDate
        : doc.completionDate
          ? new Date(doc.completionDate as string)
          : null;
    const completedAt = latestAttemptByScenario.get(idStr) ?? null;
    const dueDate = completionDate ?? createdAt;
    return {
      itemType: FREE_TALK_PLAN_ITEM_TYPE,
      assignmentId: id,
      drill: {
        _id: id,
        title: doc.title,
        type: 'eklan_free_talk',
        scenarioType: doc.scenarioType,
        date: dueDate,
        completionDate: completionDate?.toISOString() ?? null,
      },
      assignedBy: null,
      assignedAt: createdAt,
      dueDate,
      status: completedAt ? 'completed' : 'pending',
      completedAt,
      latestAttempt: null,
    };
  });

  return {
    drills: [...drills, ...freeTalkDrills],
    pagination: {
      total: result.total + freeTalkDrills.length,
      limit,
      offset,
      hasMore: offset + result.assignments.length < result.total,
    },
  };
}
