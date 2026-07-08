import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import { toUserIdCandidates, toUserIdQuery } from '@/lib/api/user-id';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';
import Drill from '@/models/drill';
import Bookmark from '@/models/bookmark';
import DrillAssignment from '@/models/drill-assignment';
import User from '@/models/user';
import FreeTalkScenario from '@/models/free-talk-scenario';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import { freeTalkScenarioLearnerFilter } from '@/lib/free-talk-scenario-assignment';
import { purgeExpiredFreeTalkScenarios } from '@/lib/free-talk-scenario-purge';
import { sortAssignedPlanItems } from '@/lib/learner-assigned-plan';
import { FREE_TALK_PLAN_ITEM_TYPE } from '@/lib/learner-assigned-plan.shared';
import type {
  LearnerFreeTalkPlanRow,
  LearnerMyDrillRow,
} from '@/lib/server/learner-my-drills.server';
import { enrichLearnerDrillRowsWithTopicTitle } from '@/lib/server/enrich-learner-drill-topic';

const LEARNER_DRILL_SELECT =
  'title type difficulty date duration_days context audio_example_url roleplay_scenes student_character_name ai_character_name ai_character_names learning_journey_part learning_journey_topic';

function isPopulatedDrillDoc(
  value: unknown,
): value is Record<string, unknown> & { _id?: Types.ObjectId; title?: string; type?: string } {
  if (value == null || typeof value !== 'object') return false;
  const doc = value as { _id?: unknown; type?: unknown };
  return doc._id != null && typeof doc.type === 'string' && doc.type.length > 0;
}

function drillRefId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return Types.ObjectId.isValid(value) ? value : null;
  if (typeof value === 'object' && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    if (id != null) return String(id);
  }
  if (typeof (value as { toString?: () => string }).toString === 'function') {
    const id = String(value);
    return Types.ObjectId.isValid(id) ? id : null;
  }
  return null;
}

export async function getBookmarkedDrillIdSet(learnerId: string): Promise<Set<string>> {
  await connectToDatabase();

  const bookmarkRows = await Bookmark.find({
    userId: { $in: toUserIdCandidates(learnerId) },
    type: 'drill',
  })
    .select('drillId')
    .lean()
    .exec();

  return new Set(bookmarkRows.map((row) => String(row.drillId)));
}

export type LearnerSavedDrillsPayload = {
  drills: LearnerMyDrillRow[];
};

/**
 * Bookmark-first saved drills list — returns all drill-level bookmarks for the
 * learner without assignment-list pagination caps.
 */
export async function getLearnerSavedDrillsPayload(
  learnerId: string,
): Promise<LearnerSavedDrillsPayload> {
  await connectToDatabase();

  const bookmarkedDrillIds = await getBookmarkedDrillIdSet(learnerId);
  if (bookmarkedDrillIds.size === 0) {
    return { drills: [] };
  }

  const attemptRepo = new AttemptRepository();
  const drillObjectIds = [...bookmarkedDrillIds]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const assignments =
    drillObjectIds.length > 0
      ? await DrillAssignment.find({
          learnerId: toUserIdQuery(learnerId),
          drillId: { $in: drillObjectIds },
        })
          .populate({
            path: 'drillId',
            model: Drill,
            select: LEARNER_DRILL_SELECT,
          })
          .populate({ path: 'assignedBy', model: User, select: 'firstName lastName email' })
          .sort({ assignedAt: -1 })
          .lean()
          .exec()
      : [];

  const validAssignments = assignments.filter(
    (assignment) => assignment.drillId && typeof assignment.drillId === 'object',
  );

  const assignmentIds = validAssignments.map((assignment) => String(assignment._id));
  const attemptMap = await attemptRepo.getLatestAttemptsForAssignments(assignmentIds);

  const missingDrillIds = [
    ...new Set(
      validAssignments
        .map((assignment) => {
          if (isPopulatedDrillDoc(assignment.drillId)) return null;
          return drillRefId(assignment.drillId);
        })
        .filter((id): id is string => id != null),
    ),
  ];

  const drillById = new Map<string, Record<string, unknown>>();
  if (missingDrillIds.length > 0) {
    const docs = await Drill.find({
      _id: { $in: missingDrillIds.map((id) => new Types.ObjectId(id)) },
    })
      .select(LEARNER_DRILL_SELECT)
      .lean()
      .exec();
    for (const doc of docs) {
      drillById.set(String(doc._id), doc as Record<string, unknown>);
    }
  }

  const resolveDrillDoc = (assignment: (typeof validAssignments)[number]) => {
    if (isPopulatedDrillDoc(assignment.drillId)) {
      return assignment.drillId;
    }
    const id = drillRefId(assignment.drillId);
    if (id && drillById.has(id)) {
      return drillById.get(id)!;
    }
    return assignment.drillId;
  };

  const assignmentRows: LearnerMyDrillRow[] = validAssignments.map((assignment) => {
    const attemptData = attemptMap.get(String(assignment._id));
    const drillDoc = resolveDrillDoc(assignment);
    return {
      assignmentId: assignment._id as Types.ObjectId,
      drill: drillDoc,
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
      hasBookmarks: true,
    };
  });

  await purgeExpiredFreeTalkScenarios();

  const scenarioRows = await FreeTalkScenario.find({
    ...freeTalkScenarioLearnerFilter(learnerId),
    _id: { $in: drillObjectIds },
  })
    .sort({ createdAt: -1 })
    .select({ title: 1, scenarioType: 1, createdAt: 1, completionDate: 1 })
    .lean()
    .exec();

  const scenarioIds = scenarioRows.map((doc) => String(doc._id));
  const attemptRows =
    scenarioIds.length > 0
      ? await FreeTalkAttempt.find({
          learnerId: toUserIdQuery(learnerId),
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

  const freeTalkRows: LearnerFreeTalkPlanRow[] = scenarioRows.map((doc) => {
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
      hasBookmarks: true,
    };
  });

  return {
    drills: enrichLearnerDrillRowsWithTopicTitle(
      sortAssignedPlanItems([...assignmentRows, ...freeTalkRows]) as LearnerMyDrillRow[],
    ),
  };
}
