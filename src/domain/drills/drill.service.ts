import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import { DrillRepository } from './drill.repository';
import { AssignmentRepository } from '../assignments/assignment.repository';
import { AttemptRepository, CreateAttemptData } from '../attempts/attempt.repository';
import { userService } from '@/lib/api/user.service';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/api/response';
import { sendDrillAssignmentNotification } from '@/lib/api/email.service';
import {
  formatDrillNotificationLabel,
  getDrillTopicTitle,
} from '@/lib/drill-display-label';
import { onDrillCompleted, onDrillAssigned } from '@/services/notification/triggers';
import { toUserIdQuery } from '@/lib/api/user-id';
import {
  getMissionNumberLabel,
  parseLearningJourneyPartId,
} from '@/domain/learning-journey/learning-journey.catalog';
import { getDrillTypeLabel } from '@/utils/drill';
import Bookmark from '@/models/bookmark';
import WordAnalytics from '@/models/word-analytics';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import Profile from '@/models/profile';
import User from '@/models/user';
import type {
  AssignDrillParams,
  Drill as DrillType,
  CreateDrillData,
  CompleteDrillParams,
  DrillListFilters,
} from './drill.types';
import type { CreateAssignmentData } from '../assignments/assignment.types';
import { getAssignedAtForWeek } from '@/lib/ai-drill-builder/week-utils';

function resolveAssignmentAssignedAt(
  learner: {
    subscriptionActivatedAt?: Date | string | null;
    createdAt?: Date | string | null;
  },
  weekNumber?: number,
): Date {
  if (
    weekNumber == null ||
    !Number.isFinite(weekNumber) ||
    weekNumber < 1
  ) {
    return new Date();
  }
  return getAssignedAtForWeek(
    weekNumber,
    learner.subscriptionActivatedAt,
    learner.createdAt,
  );
}

export type DrillAssignmentNotifyTarget = {
  learnerId: Types.ObjectId | string;
  _id?: Types.ObjectId | string;
  dueDate?: Date | string | null;
};

export type DrillAssignmentNotifyDrill = {
  _id: Types.ObjectId | string;
  title?: string | null;
  type?: string | null;
  learning_journey_part?: number | null;
  learning_journey_topic?: string | null;
};

export type DrillAssignmentNotifyResult = {
  status: 'sent' | 'skipped';
  reason?: string;
  channels?: { email: boolean; push: boolean };
};

function formatAssignerName(assigner: {
  firstName?: string;
  lastName?: string;
  name?: string;
}): string {
  return (
    assigner.name ||
    `${assigner.firstName || ''} ${assigner.lastName || ''}`.trim() ||
    'Your tutor'
  );
}

export type NotifyLearnerOfAssignmentDeps = {
  findProfile: (learnerId: string) => Promise<{
    notificationPreferences?: { learningReminders?: boolean };
  } | null>;
  findLearner: (learnerId: string) => Promise<{
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null>;
  sendEmail: typeof sendDrillAssignmentNotification;
  sendPush: typeof onDrillAssigned;
};

async function defaultFindProfile(learnerId: string) {
  return Profile.findOne({ userId: learnerId })
    .select('notificationPreferences')
    .lean() as Promise<{
    notificationPreferences?: { learningReminders?: boolean };
  } | null>;
}

async function defaultFindLearner(learnerId: string) {
  return User.findById(learnerId)
    .select('email firstName lastName name')
    .lean() as Promise<{
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null>;
}

/**
 * Notify one learner of a new drill assignment (prefs gate → email + in-app/push).
 * Shared by DrillService and assign/bulk routes. Safe to await; channels fail independently.
 */
export async function notifyLearnerOfAssignment(
  params: {
    learnerId: string;
    drill: DrillAssignmentNotifyDrill;
    assigner: { firstName?: string; lastName?: string; name?: string };
    dueDate?: Date | string | null;
    assignmentId?: string;
  },
  deps: Partial<NotifyLearnerOfAssignmentDeps> = {}
): Promise<DrillAssignmentNotifyResult> {
  const { learnerId, drill, assigner, dueDate, assignmentId } = params;
  const drillId = drill._id.toString();
  const findProfile = deps.findProfile ?? defaultFindProfile;
  const findLearner = deps.findLearner ?? defaultFindLearner;
  const sendEmail = deps.sendEmail ?? sendDrillAssignmentNotification;
  const sendPush = deps.sendPush ?? onDrillAssigned;

  const profile = await findProfile(learnerId);
  if (profile?.notificationPreferences?.learningReminders === false) {
    return { status: 'skipped', reason: 'prefs_disabled' };
  }

  const learner = await findLearner(learnerId);

  const studentName =
    `${learner?.firstName ?? ''} ${learner?.lastName ?? ''}`.trim() ||
    learner?.name ||
    'Student';

  const assignerName = formatAssignerName(assigner);
  const dueDateObj =
    dueDate == null || dueDate === ''
      ? undefined
      : dueDate instanceof Date
        ? dueDate
        : new Date(dueDate);

  const displayLabel = formatDrillNotificationLabel(drill);
  const drillTypeLabel = getDrillTypeLabel(drill.type);
  const partId = parseLearningJourneyPartId(drill.learning_journey_part);
  const missionLabel = partId != null ? getMissionNumberLabel(partId) : undefined;
  const topicLabel = getDrillTopicTitle(drill) ?? undefined;

  let emailSucceeded = false;
  let pushSucceeded = false;

  if (learner?.email) {
    try {
      await sendEmail({
        studentEmail: learner.email,
        studentName,
        drillTitle: displayLabel,
        drillType: drillTypeLabel,
        missionLabel,
        topicLabel,
        dueDate: dueDateObj && !Number.isNaN(dueDateObj.getTime()) ? dueDateObj : undefined,
        assignerName,
        drillId,
        assignmentId,
      });
      emailSucceeded = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Drill assignment email failed', { learnerId, drillId, msg });
    }
  }

  try {
    const pushResult = await sendPush(
      learnerId,
      { _id: drillId, title: displayLabel, type: drill.type ?? '' },
      {
        firstName: assigner.firstName,
        lastName: assigner.lastName,
        name: assigner.name,
      }
    );
    if (pushResult) {
      pushSucceeded = true;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Drill assignment push/in-app failed', { learnerId, drillId, msg });
  }

  if (emailSucceeded || pushSucceeded) {
    return {
      status: 'sent',
      channels: { email: emailSucceeded, push: pushSucceeded },
    };
  }

  return { status: 'skipped', reason: 'delivery_failed' };
}

/**
 * Fire-and-forget notify for newly created assignments.
 * Assignment APIs must never fail because of notification errors.
 */
export function notifyLearnersOfAssignment(
  assignments: DrillAssignmentNotifyTarget[],
  drill: DrillAssignmentNotifyDrill,
  assigner: { firstName?: string; lastName?: string; name?: string }
): void {
  const drillId = drill._id.toString();
  for (const assignment of assignments) {
    const learnerId = assignment.learnerId.toString();
    notifyLearnerOfAssignment({
      learnerId,
      drill,
      assigner,
      dueDate: assignment.dueDate,
      assignmentId: assignment._id?.toString(),
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to send drill assignment notification', {
        error: message,
        learnerId,
        drillId,
      });
    });
  }
}

/** Alias kept for call sites that prefer a DrillService-shaped API. */
const dispatchNotifyLearnersOfAssignment = notifyLearnersOfAssignment;

/**
 * Drill Service
 * Contains business logic for drill operations
 */
export class DrillService {
  constructor(
    private drillRepo: DrillRepository,
    private assignmentRepo: AssignmentRepository,
    private attemptRepo: AttemptRepository
  ) {}

  private assertBulkAssignmentCount(
    created: Array<{ learnerId: Types.ObjectId | string }>,
    expected: CreateAssignmentData[],
    context: string
  ): void {
    if (created.length === expected.length) {
      return;
    }

    const createdIds = new Set(created.map((a) => a.learnerId.toString()));
    const failedLearnerIds = expected
      .map((a) => a.learnerId.toString())
      .filter((id) => !createdIds.has(id));

    throw new ValidationError(
      `${context}: expected ${expected.length} assignments but created ${created.length}`,
      { failedLearnerIds }
    );
  }

  /** Shared notify entry used by create/update/assign paths. */
  notifyLearnersOfAssignment(
    assignments: DrillAssignmentNotifyTarget[],
    drill: DrillAssignmentNotifyDrill,
    assigner: { firstName?: string; lastName?: string; name?: string }
  ): void {
    dispatchNotifyLearnersOfAssignment(assignments, drill, assigner);
  }

  private notifyDrillAssigned(
    assignments: DrillAssignmentNotifyTarget[],
    drill: DrillAssignmentNotifyDrill,
    assigner: { firstName?: string; lastName?: string; name?: string }
  ): void {
    dispatchNotifyLearnersOfAssignment(assignments, drill, assigner);
  }

  /** 
   * Assign drill to multiple users
   * Handles validation, duplicate checking, and assignment creation
   */
  async assignDrill(params: AssignDrillParams) {
    // 1. Validate drill exists
    const drill = await this.drillRepo.findById(params.drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // 2. Validate assigner exists
    const assigner = await userService.findById(
      params.assignedBy,
      'role email firstName lastName name'
    ).catch(() => {
      throw new NotFoundError('Assigner');
    });

    // 3. Validate all users exist and have 'user' role
    const users = await userService.findMultipleWithRole(
      params.userIds,
      'user',
      'email firstName lastName subscriptionActivatedAt createdAt'
    );

    // 4. Calculate due date
    let dueDate: Date | undefined;
    if (params.dueDate) {
      dueDate = new Date(params.dueDate);
    } else {
      // Use drill.date as completion date, or calculate from assignment date + duration
      if (drill.date) {
        dueDate = new Date(drill.date);
      } else {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (drill.duration_days || 1));
      }
    }

    // 5. Check for existing assignments (prevent duplicates)
    const existingAssignments = await this.assignmentRepo.findExisting(
      params.drillId,
      params.userIds
    );

    // 6. Prepare new assignments for users that don't have one yet
    const newAssignmentsData: CreateAssignmentData[] = users
      .filter((user) => !existingAssignments.has(user._id.toString()))
      .map((user) => ({
        drillId: new Types.ObjectId(params.drillId),
        learnerId: user._id,
        // assignedBy may be a UUID (Better Auth admin/tutor account)
        assignedBy: toUserIdQuery(params.assignedBy),
        assignedAt: resolveAssignmentAssignedAt(user, params.weekNumber),
        dueDate: dueDate!,
        status: 'pending' as const,
      }));

    // 7. Create assignments in bulk
    let successfulAssignments: any[] = [];
    if (newAssignmentsData.length > 0) {
      successfulAssignments = await this.assignmentRepo.createBulk(newAssignmentsData);

      // 8. Update drill's totalAssignments count
      await this.drillRepo.incrementAssignments(
        params.drillId,
        successfulAssignments.length
      );
    }

    if (successfulAssignments.length > 0) {
      this.notifyDrillAssigned(successfulAssignments, drill, assigner);
    }

    logger.info('Drill assigned to users', {
      drillId: drill._id,
      assignedBy: assigner.email,
      userCount: successfulAssignments.length,
    });

    return {
      assignments: successfulAssignments,
      skipped: existingAssignments.size,
      total: successfulAssignments.length,
    };
  }

  /**
   * List drills with filters
   */
  async listDrills(
    filters: DrillListFilters
  ): Promise<{ drills: DrillType[]; total: number; limit: number; offset: number }> {
    const drills = await this.drillRepo.findMany(filters);
    const total = await this.drillRepo.countMany(filters);

    return {
      drills,
      total,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    };
  }

  /**
   * Toggle shared admin-library bookmark on a drill (admin/tutor).
   */
  async setDrillBookmarked(
    drillId: string,
    bookmarked: boolean,
    context: { userId: string; userRole: string }
  ): Promise<DrillType> {
    if (context.userRole !== 'admin' && context.userRole !== 'tutor') {
      throw new ForbiddenError('Only admins and tutors can bookmark drills');
    }

    const existing = await this.drillRepo.findById(drillId);
    if (!existing) {
      throw new NotFoundError('Drill');
    }

    const updated = await this.drillRepo.update(drillId, {
      is_bookmarked: bookmarked,
      bookmarked_at: bookmarked ? new Date() : null,
    });

    if (!updated) {
      throw new NotFoundError('Drill');
    }

    logger.info('Drill bookmark updated', {
      drillId,
      bookmarked,
      userId: context.userId,
      userRole: context.userRole,
    });

    return updated;
  }

  /**
   * Create a new drill with assignments
   */
  async createDrill(params: {
    drillData: CreateDrillData;
    creatorId: string;
    assignedUserIds: string[];
    /** When set, assignedAt is placed in that drill-builder week for each learner. */
    weekNumber?: number;
  }): Promise<{
    drill: DrillType;
    assignmentCount: number;
    assignmentsRequested: number;
    assignmentsCreated: number;
    failedLearnerIds: string[];
  }> {
    // 1. Validate creator exists
    const creator = await userService.findById(
      params.creatorId,
      'email role firstName lastName name'
    );

    // 2. Validate assigned users (skip when saving without assignment)
    const assignedUsers =
      params.assignedUserIds.length > 0
        ? await userService.findMultipleWithRole(
            params.assignedUserIds,
            'user',
            'email firstName lastName subscriptionActivatedAt createdAt'
          )
        : [];

    if (params.assignedUserIds.length > 0) {
      const foundIds = new Set(assignedUsers.map((u) => u._id.toString()));
      const missingLearnerIds = params.assignedUserIds.filter((id) => !foundIds.has(id));
      if (missingLearnerIds.length > 0) {
        throw new ValidationError(
          `Could not assign drill to ${missingLearnerIds.length} learner(s). Check that each selected user exists and has the learner role.`,
          { failedLearnerIds: missingLearnerIds },
        );
      }
    }

    // 3. Create drill
    const drill = await this.drillRepo.create({
      ...params.drillData,
      // creatorId may be a UUID (Better Auth admin/tutor account)
      createdById: toUserIdQuery(params.creatorId),
      created_by: creator.email,
    });

    // 4. Create assignments
    let assignmentCount = 0;
    if (assignedUsers.length > 0) {
      // Check for existing assignments
      const existingAssignments = await this.assignmentRepo.findExisting(
        drill._id.toString(),
        params.assignedUserIds
      );

      // Calculate due date
      const dueDate = params.drillData.date || new Date();

      // Create new assignments
      const newAssignmentsData: CreateAssignmentData[] = assignedUsers
        .filter((user) => !existingAssignments.has(user._id.toString()))
        .map((user) => ({
          drillId: drill._id,
          learnerId: user._id,
          // creatorId may be a UUID (Better Auth admin/tutor account) — a raw
          // `new Types.ObjectId(...)` throws for UUID ids, unlike toUserIdQuery.
          assignedBy: toUserIdQuery(params.creatorId),
          assignedAt: resolveAssignmentAssignedAt(user, params.weekNumber),
          dueDate: dueDate,
          status: 'pending' as const,
        }));

      if (newAssignmentsData.length > 0) {
        const createdAssignments = await this.assignmentRepo.createBulk(newAssignmentsData);
        this.assertBulkAssignmentCount(
          createdAssignments,
          newAssignmentsData,
          'createDrill'
        );
        assignmentCount = createdAssignments.length;

        const assignedLearnerIds = createdAssignments.map((a) =>
          a.learnerId.toString()
        );
        await this.drillRepo.update(drill._id.toString(), {
          assigned_to: assignedLearnerIds,
        });
        drill.assigned_to = assignedLearnerIds;

        // Update drill assignment count
        await this.drillRepo.incrementAssignments(drill._id.toString(), assignmentCount);

        this.notifyDrillAssigned(createdAssignments, drill, creator);
      }
    }

    logger.info('Drill created successfully', {
      drillId: drill._id,
      createdBy: params.creatorId,
      assignmentsCreated: assignmentCount,
    });

    return {
      drill,
      assignmentCount,
      assignmentsRequested: params.assignedUserIds.length,
      assignmentsCreated: assignmentCount,
      failedLearnerIds: [],
    };
  }

  /**
   * Get drill by ID with permission check
   */
  async getDrillById(
    drillId: string,
    userId: string,
    userRole: 'admin' | 'user' | 'tutor',
    assignmentId?: string
  ): Promise<{ drill: DrillType; assignment?: any }> {
    // Validate drill ID
    if (!Types.ObjectId.isValid(drillId)) {
      throw new ValidationError('Invalid drill ID format');
    }

    // Get drill
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // If assignmentId provided, verify assignment
    if (assignmentId) {
      if (!Types.ObjectId.isValid(assignmentId)) {
        throw new ValidationError('Invalid assignment ID format');
      }

      const assignment = await this.assignmentRepo.findMany({
        learnerId: userId,
        drillId: drillId,
        limit: 1,
      });

      const foundAssignment = assignment.find(
        (a: any) => a._id.toString() === assignmentId
      );

      if (!foundAssignment) {
        throw new NotFoundError('Assignment');
      }

      return {
        drill,
        assignment: {
          assignmentId: foundAssignment._id,
          status: foundAssignment.status,
          dueDate: foundAssignment.dueDate,
          completedAt: foundAssignment.completedAt,
        },
      };
    }

    // Role-based permission check
    if (userRole === 'admin') {
      return { drill };
    }

    if (userRole === 'tutor') {
      const isCreator =
        drill.createdById?.toString() === userId ||
        drill.created_by === (await userService.findById(userId, 'email')).email;

      if (!isCreator) {
        throw new ForbiddenError('You do not have permission to view this drill');
      }

      return { drill };
    }

    // User role - must have assignment
    const assignments = await this.assignmentRepo.findMany({
      learnerId: userId,
      drillId: drillId,
      limit: 1,
    });

    if (assignments.length === 0) {
      throw new ForbiddenError('You do not have access to this drill');
    }

    return { drill };
  }

  /**
   * Delete all learner-side data for a drill (assignments, attempts, bookmarks, etc.)
   */
  private async cascadeDeleteLearnerData(drillId: string): Promise<void> {
    const drillObjectId = new Types.ObjectId(drillId);

    const [assignmentsDeleted, attemptsDeleted, bookmarksDeleted, pronunciationDeleted] =
      await Promise.all([
        this.assignmentRepo.deleteByDrillId(drillId),
        this.attemptRepo.deleteByDrillId(drillId),
        Bookmark.deleteMany({ drillId: drillObjectId }).exec(),
        PronunciationAttempt.deleteMany({ drillId: drillObjectId }).exec(),
      ]);

    const wordAnalyticsResult = await WordAnalytics.updateMany(
      { 'scoreHistory.drillId': drillObjectId },
      { $pull: { scoreHistory: { drillId: drillObjectId } } }
    ).exec();

    logger.info('Cascade deleted learner data for drill', {
      drillId,
      assignmentsDeleted,
      attemptsDeleted,
      bookmarksDeleted: bookmarksDeleted.deletedCount,
      pronunciationAttemptsDeleted: pronunciationDeleted.deletedCount,
      wordAnalyticsUpdated: wordAnalyticsResult.modifiedCount,
    });
  }

  /**
   * Update drill
   */
  async updateDrill(
    drillId: string,
    userId: string,
    userRole: 'admin' | 'user' | 'tutor',
    data: Partial<CreateDrillData>
  ): Promise<{
    drill: DrillType;
    newAssignmentsCreated: number;
    assignmentsRequested: number;
    assignmentsCreated: number;
    failedLearnerIds: string[];
  }> {
    // Validate drill ID
    if (!Types.ObjectId.isValid(drillId)) {
      throw new ValidationError('Invalid drill ID format');
    }

    // Get drill
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // Check permissions
    const user = await userService.findById(userId, 'email role');
    if (userRole !== 'admin' && drill.created_by !== user.email) {
      throw new ForbiddenError('You do not have permission to update this drill');
    }

    const isReassignment = data.assigned_to !== undefined && data.assigned_to.length > 0;
    const hasExistingLearnerData =
      (drill.totalAssignments ?? 0) > 0 ||
      (await this.assignmentRepo.count({ drillId: new Types.ObjectId(drillId) })) > 0;

    // Validate users and prepare assignment docs before destructive cascade delete
    let assignmentsData: CreateAssignmentData[] = [];
    if (isReassignment) {
      const assignedUsers = await userService.findMultipleWithRole(
        data.assigned_to!,
        'user',
        'email firstName lastName'
      );

      const dueDate = data.date || drill.date || new Date();
      assignmentsData = assignedUsers.map((learner) => ({
        drillId: new Types.ObjectId(drillId),
        learnerId: learner._id,
        // userId (the updater) may be a UUID (Better Auth admin/tutor account)
        assignedBy: toUserIdQuery(userId),
        assignedAt: new Date(),
        dueDate: dueDate,
        status: 'pending' as const,
      }));
    }

    // Reassignment path: wipe learner data only after validation passes
    if (isReassignment && hasExistingLearnerData) {
      await this.cascadeDeleteLearnerData(drillId);
      await this.drillRepo.setTotalAssignments(drillId, 0);
    }

    // Update drill; assigned_to is set after successful bulk insert
    const { assigned_to: _requestedAssignees, ...drillFields } = data;
    const updatePayload = isReassignment ? drillFields : data;
    const updatedDrill = await this.drillRepo.update(drillId, updatePayload);

    if (!updatedDrill) {
      throw new NotFoundError('Drill');
    }

    // Create assignments for all selected users when assigned_to is provided
    let newAssignmentsCount = 0;
    if (isReassignment && assignmentsData.length > 0) {
      const created = await this.assignmentRepo.createBulk(assignmentsData);
      this.assertBulkAssignmentCount(created, assignmentsData, 'updateDrill');
      newAssignmentsCount = created.length;

      const assignedLearnerIds = created.map((a) => a.learnerId.toString());
      const drillWithAssignees = await this.drillRepo.update(drillId, {
        assigned_to: assignedLearnerIds,
      });
      if (drillWithAssignees) {
        updatedDrill.assigned_to = drillWithAssignees.assigned_to;
      }

      await this.drillRepo.setTotalAssignments(drillId, newAssignmentsCount);

      if (newAssignmentsCount > 0) {
        updatedDrill.is_active = true;
        updatedDrill.totalAssignments = newAssignmentsCount;
      }

      const assigner = await userService.findById(
        userId,
        'email role firstName lastName name'
      );
      this.notifyDrillAssigned(created, updatedDrill, assigner);
    }

    return {
      drill: updatedDrill,
      newAssignmentsCreated: newAssignmentsCount,
      assignmentsRequested: data.assigned_to?.length ?? 0,
      assignmentsCreated: newAssignmentsCount,
      failedLearnerIds: [],
    };
  }

  /**
   * Delete drill
   */
  async deleteDrill(
    drillId: string,
    userId: string,
    userRole: 'admin' | 'user' | 'tutor'
  ): Promise<void> {
    // Validate drill ID
    if (!Types.ObjectId.isValid(drillId)) {
      throw new ValidationError('Invalid drill ID format');
    }

    // Get drill
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // Check permissions
    const user = await userService.findById(userId, 'email role');
    if (userRole !== 'admin' && drill.created_by !== user.email) {
      throw new ForbiddenError('You do not have permission to delete this drill');
    }

    // Cascade delete learner data, then remove drill
    await this.cascadeDeleteLearnerData(drillId);
    await this.drillRepo.delete(drillId);
  }

  /**
   * Complete a drill and create attempt record
   */
  async completeDrill(
    drillId: string,
    params: CompleteDrillParams
  ): Promise<{ attempt: any }> {
    // 1. Validate drill exists
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // 2. Verify assignment exists and belongs to user
    const assignment = await this.assignmentRepo.findById(params.drillAssignmentId);
    if (!assignment) {
      throw new NotFoundError('Drill assignment');
    }

    // 3. Verify assignment belongs to the user
    if (assignment.learnerId.toString() !== params.learnerId) {
      throw new ForbiddenError('You do not have permission to complete this drill assignment');
    }

    // 4. Verify assignment is for the correct drill
    // Handle both populated (object) and unpopulated (ObjectId) drillId in a type-safe way
    const assignmentDrillId: any = (assignment as any).drillId;
    let assignmentDrillIdStr: string;

    if (assignmentDrillId && typeof assignmentDrillId === 'object' && '_id' in assignmentDrillId) {
      // drillId is populated (object with _id)
      assignmentDrillIdStr = assignmentDrillId._id.toString();
    } else {
      // drillId is likely an ObjectId or string
      assignmentDrillIdStr = String(assignmentDrillId);
    }

    const requestedDrillIdStr = String(drillId);

    if (assignmentDrillIdStr !== requestedDrillIdStr) {
      logger.error('Drill assignment mismatch', {
        assignmentId: params.drillAssignmentId,
        assignmentDrillId: assignmentDrillIdStr,
        requestedDrillId: requestedDrillIdStr,
        learnerId: params.learnerId,
        assignmentDrillIdRaw: assignmentDrillId,
        assignmentDrillIdType: typeof assignmentDrillId,
        requestedDrillIdType: typeof drillId,
      });
      throw new ValidationError(
        `Drill assignment does not match drill ID. Assignment is for drill ${assignmentDrillIdStr}, but you're trying to complete drill ${requestedDrillIdStr}`
      );
    }

    // 5. Create drill attempt
    const attemptData: CreateAttemptData = {
      drillAssignmentId: new Types.ObjectId(params.drillAssignmentId),
      // learnerId may be a UUID (Better Auth web sign-up, incl. Google/Apple OAuth)
      learnerId: toUserIdQuery(params.learnerId),
      drillId: new Types.ObjectId(drillId),
      drillType: drill.type,
      startedAt: new Date(Date.now() - params.timeSpent * 1000),
      completedAt: new Date(),
      timeSpent: params.timeSpent,
      score: params.score,
      maxScore: 100,
      vocabularyResults: params.results.vocabularyResults,
      pronunciationResults: params.results.pronunciationResults,
      roleplayResults: params.results.roleplayResults,
      matchingResults: params.results.matchingResults,
      definitionResults: params.results.definitionResults,
      grammarResults: params.results.grammarResults,
      sentenceWritingResults: params.results.sentenceWritingResults,
      sentenceResults: params.results.sentenceResults,
      summaryResults: params.results.summaryResults,
      listeningResults: params.results.listeningResults,
      fillBlankResults: params.results.fillBlankResults,
      keyPhrasesResults: params.results.keyPhrasesResults,
      performanceReviewSnapshot: params.results.performanceReviewSnapshot,
      deviceInfo: params.results.deviceInfo,
      platform: params.results.platform || 'web',
    };

    const attempt = await this.attemptRepo.create(attemptData);

    // 6. Update assignment status
    await this.assignmentRepo.updateStatus(
      params.drillAssignmentId,
      'completed',
      new Date()
    );

    // 7. Send notification to tutor (async)
    this.sendCompletionNotification(drill, assignment, params)
      .catch((err) => {
        logger.error('Error sending completion notification', { error: err.message });
      });

    logger.info('Drill completed successfully', {
      drillId,
      assignmentId: params.drillAssignmentId,
      userId: params.learnerId,
      score: params.score,
      attemptId: attempt._id,
    });

    return { attempt };
  }

  /**
   * Send completion notification to tutor
   */
  private async sendCompletionNotification(
    drill: DrillType,
    assignment: any,
    params: CompleteDrillParams
  ): Promise<void> {
    try {
      const fullAssignment = await this.assignmentRepo.findById(
        params.drillAssignmentId
      );

      if (fullAssignment?.assignedBy) {
        const tutorId = fullAssignment.assignedBy.toString();
        const student = await userService.findById(
          params.learnerId,
          'firstName lastName name email'
        );

        await onDrillCompleted(
          tutorId,
          {
            _id: params.learnerId,
            name: (student as any).name,
            firstName: student.firstName,
            lastName: student.lastName,
          },
          {
            _id: drill._id.toString(),
            title: drill.title,
          },
          params.drillAssignmentId,
          params.score
        );
      }
    } catch (error: any) {
      logger.error('Failed to send drill completion notification', {
        error: error.message,
      });
    }
  }
}

