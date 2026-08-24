import DrillAssignment from '@/models/drill-assignment';
import Drill from '@/models/drill';
import User from '@/models/user';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import { ValidationError } from '@/lib/api/response';
import { toUserIdQuery, toUserIdQueryMulti } from '@/lib/api/user-id';
import type { DrillAssignment as AssignmentType, CreateAssignmentData, AssignmentFilters } from './assignment.types';

type AssignmentStatus = AssignmentType['status'];

/**
 * Query for status writes. Never match a completed assignment when flipping
 * to in-progress so a later checkpoint cannot downgrade a finished drill.
 */
export function buildAssignmentStatusUpdateFilter(
  assignmentId: string,
  status: AssignmentStatus,
): Record<string, unknown> {
  if (status === 'in-progress') {
    return { _id: assignmentId, status: { $ne: 'completed' } };
  }
  return { _id: assignmentId };
}

/**
 * Repository for drill assignment data access
 */
export class AssignmentRepository {
  /**
   * Find assignment by ID
   */
  async findById(assignmentId: string): Promise<AssignmentType | null> {
    try {
      return await DrillAssignment.findById(assignmentId)
        .populate({ path: 'drillId', model: Drill, select: 'title type difficulty' })
        .populate({ path: 'assignedBy', model: User, select: 'firstName lastName email' })
        .lean()
        .exec();
    } catch (error: any) {
      logger.error('Error finding assignment by ID', { assignmentId, error: error.message });
      throw error;
    }
  }

  /**
   * Find assignments with filters
   */
  async findMany(filters: AssignmentFilters): Promise<AssignmentType[]> {
    try {
      const query: any = {};

      if (filters.learnerId) {
        query.learnerId = toUserIdQuery(filters.learnerId);
      }
      if (filters.drillId) {
        query.drillId = new Types.ObjectId(filters.drillId);
      }
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.assignedBy) {
        query.assignedBy = toUserIdQuery(filters.assignedBy);
      }

      const queryBuilder = DrillAssignment.find(query)
        .populate({ path: 'drillId', model: Drill, select: 'title type difficulty' })
        .populate({ path: 'assignedBy', model: User, select: 'firstName lastName email' })
        .sort({ assignedAt: -1 });

      if (filters.limit) {
        queryBuilder.limit(filters.limit);
      }
      if (filters.offset) {
        queryBuilder.skip(filters.offset);
      }

      return queryBuilder.lean().exec();
    } catch (error: any) {
      logger.error('Error finding assignments', { filters, error: error.message });
      throw error;
    }
  }

  /**
   * Find existing assignments for drill and users
   */
  async findExisting(drillId: string, userIds: string[]): Promise<Set<string>> {
    try {
      const assignments = await DrillAssignment.find({
        drillId: new Types.ObjectId(drillId),
        learnerId: { $in: toUserIdQueryMulti(userIds) },
      })
        .select('learnerId')
        .lean()
        .exec();

      return new Set(assignments.map(a => a.learnerId.toString()));
    } catch (error: any) {
      logger.error('Error finding existing assignments', { drillId, error: error.message });
      throw error;
    }
  }

  /**
   * Create single assignment
   */
  async create(data: CreateAssignmentData): Promise<AssignmentType> {
    try {
      const assignment = await DrillAssignment.create(data);
      return assignment.toObject();
    } catch (error: any) {
      logger.error('Error creating assignment', { error: error.message });
      throw error;
    }
  }

  /**
   * Create multiple assignments (bulk insert).
   *
   * Prod verification (no live DB required in CI): for an affected drillId, compare
   * `db.drills.assigned_to` vs `db.drill_assignments.find({ drillId })` and check logs
   * for "Bulk assignment insert had write errors".
   */
  async createBulk(assignments: CreateAssignmentData[]): Promise<AssignmentType[]> {
    if (assignments.length === 0) {
      return [];
    }

    try {
      const created = await DrillAssignment.insertMany(assignments, {
        ordered: false,
      });
      return created.map(a => a.toObject());
    } catch (error: any) {
      if (error.writeErrors?.length > 0) {
        const failedLearnerIds = error.writeErrors
          .map((we: { op?: { learnerId?: Types.ObjectId } }) =>
            we.op?.learnerId?.toString()
          )
          .filter((id: string | undefined): id is string => Boolean(id));

        logger.error('Bulk assignment insert had write errors', {
          requested: assignments.length,
          failed: error.writeErrors.length,
          failedLearnerIds,
        });

        throw new ValidationError(
          `Failed to assign drill to ${error.writeErrors.length} student(s)`,
          {
            failedLearnerIds,
            writeErrors: error.writeErrors.map(
              (we: { code?: number; errmsg?: string; op?: { learnerId?: Types.ObjectId } }) => ({
                code: we.code,
                message: we.errmsg,
                learnerId: we.op?.learnerId?.toString(),
              })
            ),
          }
        );
      }
      logger.error('Error creating assignments in bulk', { error: error.message });
      throw error;
    }
  }

  /**
   * Update assignment status
   */
  async updateStatus(
    assignmentId: string,
    status: AssignmentStatus,
    completedAt?: Date
  ): Promise<AssignmentType | null> {
    try {
      const update: Record<string, unknown> = { status };
      if (completedAt) {
        update.completedAt = completedAt;
      }

      return await DrillAssignment.findOneAndUpdate(
        buildAssignmentStatusUpdateFilter(assignmentId, status),
        update,
        { new: true },
      )
        .lean()
        .exec();
    } catch (error: any) {
      logger.error('Error updating assignment status', { assignmentId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete all assignments for a drill
   */
  async deleteByDrillId(drillId: string): Promise<number> {
    try {
      const result = await DrillAssignment.deleteMany({
        drillId: new Types.ObjectId(drillId),
      }).exec();
      return result.deletedCount;
    } catch (error: any) {
      logger.error('Error deleting assignments by drill ID', { drillId, error: error.message });
      throw error;
    }
  }

  /**
   * Count assignments
   */
  async count(filter?: any): Promise<number> {
    return DrillAssignment.countDocuments(filter || {}).exec();
  }

  /**
   * Find assignments for a specific drill
   */
  async findByDrillId(
    drillId: string,
    filters?: { limit?: number; offset?: number }
  ): Promise<{ assignments: AssignmentType[]; total: number }> {
    try {
      const query = { drillId: new Types.ObjectId(drillId) };

      // learnerId is Mixed (ObjectId or UUID string) and no longer has a
      // schema-level `ref`, so `model: User` is passed explicitly here.
      // Populate resolves correctly for both id formats because User._id is
      // also Mixed (see src/models/user.ts) and therefore isn't cast.
      const assignments = await DrillAssignment.find(query)
        .populate({ path: 'learnerId', model: User, select: 'firstName lastName email' })
        .populate({ path: 'assignedBy', model: User, select: 'firstName lastName email' })
        .sort({ assignedAt: -1 })
        .limit(filters?.limit || 100)
        .skip(filters?.offset || 0)
        .lean()
        .exec();

      const total = await DrillAssignment.countDocuments(query).exec();

      return { assignments, total };
    } catch (error: any) {
      logger.error('Error finding assignments by drill ID', { drillId, error: error.message });
      throw error;
    }
  }

  /**
   * Find assignments for a learner
   */
  async findByLearnerId(
    learnerId: string,
    filters?: { status?: string; limit?: number; offset?: number }
  ): Promise<{ assignments: AssignmentType[]; total: number }> {
    try {
      const query: any = { learnerId: toUserIdQuery(learnerId) };
      // Home/My Plans/Learning Journey must never mix in Precision Clinic
      // assignments — that surface has its own dedicated read path.
      query.source = { $ne: 'precision_clinic' };

      if (filters?.status) {
        // Map frontend status to backend status format
        const statusMap: Record<string, string> = {
          pending: 'pending',
          in_progress: 'in-progress',
          completed: 'completed',
          overdue: 'overdue',
          skipped: 'skipped',
        };
        query.status = statusMap[filters.status] || filters.status;
      }

      const assignments = await DrillAssignment.find(query)
        .populate({
          path: 'drillId',
          model: Drill,
          // List select only — omit roleplay_scenes/context (heavy); detail routes fetch those.
          select:
            'title type difficulty date duration_days audio_example_url student_character_name ai_character_name ai_character_names learning_journey_part learning_journey_topic',
        })
        .populate({ path: 'assignedBy', model: User, select: 'firstName lastName email' })
        // Descending so a hit `limit` keeps the most recent (most actionable)
        // assignments rather than silently dropping newly-assigned drills once a
        // learner passes the limit. Callers that need a specific display order
        // (e.g. "My Plans") re-sort client-side via sortAssignedPlanItems.
        .sort({ assignedAt: -1 })
        .limit(filters?.limit || 100)
        .skip(filters?.offset || 0)
        .lean()
        .exec();

      const total = await DrillAssignment.countDocuments(query).exec();

      // Exclude assignments whose drill was deleted (populate returns null for missing refs)
      const validAssignments = assignments.filter(
        (a) => a.drillId && typeof a.drillId === 'object'
      );

      return { assignments: validAssignments, total };
    } catch (error: any) {
      logger.error('Error finding assignments by learner ID', { learnerId, error: error.message });
      throw error;
    }
  }
}

