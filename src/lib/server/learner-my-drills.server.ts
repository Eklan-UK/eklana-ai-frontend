import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/api/db';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import type { DrillAssignment as AssignmentRow } from '@/domain/assignments/assignment.types';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';
import Drill from '@/models/drill';
import FreeTalkScenario from '@/models/free-talk-scenario';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import { freeTalkScenarioLearnerFilter } from '@/lib/free-talk-scenario-assignment';
import { toUserIdCandidates, toUserIdQuery } from '@/lib/api/user-id';
import { getBookmarkedDrillIdSet } from '@/lib/server/learner-saved-drills.server';
import { enrichLearnerDrillRowsWithTopicTitle } from '@/lib/server/enrich-learner-drill-topic';
import DrillAssignment from '@/models/drill-assignment';
import type { CreateAssignmentData } from '@/domain/assignments/assignment.types';
import { FREE_TALK_PLAN_ITEM_TYPE } from '@/lib/learner-assigned-plan.shared';

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
    hasBookmarks: boolean;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type LearnerMyDrillRow = LearnerMyDrillsPayload['drills'][number];

// List select only — omit roleplay_scenes/context (heavy); detail routes fetch those.
const LEARNER_DRILL_SELECT =
  'title type difficulty date duration_days audio_example_url student_character_name ai_character_name ai_character_names learning_journey_part learning_journey_topic';

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

export type LearnerFreeTalkPlanRow = LearnerMyDrillRow & {
	itemType: typeof FREE_TALK_PLAN_ITEM_TYPE;
};

type FreeTalkScenarioLean = {
  _id: Types.ObjectId;
  title: string;
  scenarioType?: string;
  createdAt: Date | string;
  completionDate?: Date | string | null;
};

type FreeTalkScenarioData = {
  scenarioRows: FreeTalkScenarioLean[];
  latestAttemptByScenario: Map<string, Date>;
};

/**
 * Load free-talk scenarios + latest attempt timestamps for a learner (list read).
 * Expired docs are left to the TTL index on completionDate — no write-on-read purge.
 */
async function loadFreeTalkScenarioData(learnerId: string): Promise<FreeTalkScenarioData> {
  const scenarioRows = (await FreeTalkScenario.find(freeTalkScenarioLearnerFilter(learnerId))
    .sort({ createdAt: -1 })
    .select({ title: 1, scenarioType: 1, createdAt: 1, completionDate: 1 })
    .lean()
    .exec()) as FreeTalkScenarioLean[];

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

  return { scenarioRows, latestAttemptByScenario };
}

function mapFreeTalkPlanRows(
  data: FreeTalkScenarioData,
  bookmarkedDrillIds: Set<string>,
): LearnerFreeTalkPlanRow[] {
  return data.scenarioRows.map((doc) => {
    const createdAt = doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt);
    const id = doc._id as Types.ObjectId;
    const idStr = String(id);
    const completionDate =
      doc.completionDate instanceof Date
        ? doc.completionDate
        : doc.completionDate
          ? new Date(doc.completionDate as string)
          : null;
    const completedAt = data.latestAttemptByScenario.get(idStr) ?? null;
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
      hasBookmarks: bookmarkedDrillIds.has(idStr),
    };
  });
}

/**
 * Drills can list a learner in `assigned_to` without a matching `drill_assignments`
 * row (e.g. learner lookup failed silently at create time). Backfill so the
 * student journey can surface them via my-drills.
 */
async function syncMissingAssignmentsForLearner(
  learnerId: string,
  assignmentRepo: AssignmentRepository,
): Promise<number> {
  const learnerCandidates = toUserIdCandidates(learnerId);
  const drillsWithAssignee = await Drill.find({
    assigned_to: { $in: learnerCandidates },
  })
    .select('_id date createdById')
    .lean()
    .exec();

  if (drillsWithAssignee.length === 0) return 0;

  const drillIds = drillsWithAssignee.map((d) => d._id);
  const existing = await DrillAssignment.find({
    learnerId: toUserIdQuery(learnerId),
    drillId: { $in: drillIds },
  })
    .select('drillId')
    .lean()
    .exec();

  const existingSet = new Set(existing.map((a) => String(a.drillId)));
  const missing = drillsWithAssignee.filter((d) => !existingSet.has(String(d._id)));
  if (missing.length === 0) return 0;

  const assignmentsData: CreateAssignmentData[] = missing.map((drill) => {
    const dueDate =
      drill.date instanceof Date
        ? drill.date
        : drill.date
          ? new Date(drill.date as string)
          : new Date();
    const assigner = drill.createdById != null ? String(drill.createdById) : learnerId;
    return {
      drillId: drill._id as Types.ObjectId,
      learnerId: toUserIdQuery(learnerId),
      assignedBy: toUserIdQuery(assigner),
      assignedAt: new Date(),
      dueDate,
      status: 'pending' as const,
    };
  });

  await assignmentRepo.createBulk(assignmentsData);
  return assignmentsData.length;
}

/**
 * Same data as GET /api/v1/drills/learner/my-drills — used from RSC to avoid
 * loopback fetch (wrong origin / connection refused in dev).
 *
 * learnerId is a plain string — Better Auth (web sign-up, incl. Google/Apple
 * OAuth) assigns UUID string user ids; legacy/mobile accounts use ObjectId
 * hex strings. Use toUserIdQuery()/toUserIdQuery() when building Mongoose
 * query values from it.
 */
export async function getLearnerMyDrillsPayload(
  learnerId: string,
  params: { status?: string; limit?: number; offset?: number; drillId?: string }
): Promise<LearnerMyDrillsPayload> {
  await connectToDatabase();

  const assignmentRepo = new AssignmentRepository();
  const attemptRepo = new AttemptRepository();

  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  let result = params.drillId
    ? {
        assignments: await assignmentRepo.findMany({
          learnerId,
          drillId: params.drillId,
          status: params.status,
          limit: 1,
        }),
        total: await assignmentRepo.count({
          learnerId: toUserIdQuery(learnerId),
          drillId: new Types.ObjectId(params.drillId),
        }),
      }
    : await assignmentRepo.findByLearnerId(learnerId, {
        status: params.status,
        limit,
        offset,
      });

  // Only backfill when the learner has zero assignments (avoid Drill.find on every list load).
  if (!params.drillId && result.assignments.length === 0) {
    await syncMissingAssignmentsForLearner(learnerId, assignmentRepo);
    result = await assignmentRepo.findByLearnerId(learnerId, {
      status: params.status,
      limit,
      offset,
    });
  }

  const assignmentIds = result.assignments.map((a: { _id: Types.ObjectId }) =>
    a._id.toString()
  );

  const [attemptMap, bookmarkedDrillIds, freeTalkData] = await Promise.all([
    attemptRepo.getLatestAttemptsForAssignments(assignmentIds),
    getBookmarkedDrillIdSet(learnerId),
    params.drillId ? Promise.resolve(null) : loadFreeTalkScenarioData(learnerId),
  ]);

  const freeTalkDrills = freeTalkData
    ? mapFreeTalkPlanRows(freeTalkData, bookmarkedDrillIds)
    : [];

  // Repository types drillId as ObjectId; lean+populate returns a drill subdocument at runtime.
  const populated = result.assignments as unknown as PopulatedLearnerAssignment[];

  const missingDrillIds = [
    ...new Set(
      populated
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

  const resolveDrillDoc = (assignment: PopulatedLearnerAssignment) => {
    if (isPopulatedDrillDoc(assignment.drillId)) {
      return assignment.drillId;
    }
    const id = drillRefId(assignment.drillId);
    if (id && drillById.has(id)) {
      return drillById.get(id)!;
    }
    return assignment.drillId;
  };

  const drills = populated.map((assignment) => {
    const attemptData = attemptMap.get(assignment._id.toString());
    const drillDoc = resolveDrillDoc(assignment);
    const drillId = drillRefId(drillDoc);
    return {
      assignmentId: assignment._id,
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
      hasBookmarks: drillId != null && bookmarkedDrillIds.has(drillId),
    };
  });

  // Warn when the learner has drill.assigned_to entries but zero drill_assignments rows
  // — a sign that the two collections have drifted out of sync.
  if (drills.length === 0) {
    const orphanCount = await Drill.countDocuments({ assigned_to: learnerId }).exec();
    if (orphanCount > 0) {
      console.warn(
        '[getLearnerMyDrillsPayload] User has drill.assigned_to entries but 0 drill_assignments rows — possible sync issue',
        { learnerId, orphanDrillCount: orphanCount }
      );
    }
  }

  return {
    drills: enrichLearnerDrillRowsWithTopicTitle([...drills, ...freeTalkDrills]),
    pagination: {
      total: result.total + freeTalkDrills.length,
      limit,
      offset,
      hasMore: offset + result.assignments.length < result.total,
    },
  };
}
