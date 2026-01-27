import DrillAssignment from '@/models/drill-assignment';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import type { DrillAssignment as AssignmentType, CreateAssignmentData, AssignmentFilters } from './assignment.types';

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
        .populate('drillId', 'title type difficulty')
        .populate('assignedBy', 'firstName lastName email')
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
        query.learnerId = new Types.ObjectId(filters.learnerId);
      }
      if (filters.drillId) {
        query.drillId = new Types.ObjectId(filters.drillId);
      }
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.assignedBy) {
        query.assignedBy = new Types.ObjectId(filters.assignedBy);
      }

      const queryBuilder = DrillAssignment.find(query)
        .populate('drillId', 'title type difficulty')
        .populate('assignedBy', 'firstName lastName email')
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
        learnerId: { $in: userIds.map(id => new Types.ObjectId(id)) },
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
   * Create multiple assignments (bulk insert)
   */
  async createBulk(assignments: CreateAssignmentData[]): Promise<AssignmentType[]> {
    if (assignments.length === 0) {
      return [];
    }

    try {
      const created = await DrillAssignment.insertMany(assignments, {
        ordered: false, // Continue even if some fail
      });
      return created.map(a => a.toObject());
    } catch (error: any) {
      // Handle partial failures
      if (error.writeErrors) {
        const successful = error.insertedDocs || [];
        logger.warn('Some assignments failed', {
          successful: successful.length,
          failed: error.writeErrors.length,
        });
        return successful.map((doc: any) => doc.toObject());
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
    status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped',
    completedAt?: Date
  ): Promise<AssignmentType | null> {
    try {
      const update: any = { status };
      if (completedAt) {
        update.completedAt = completedAt;
      }

      return await DrillAssignment.findByIdAndUpdate(assignmentId, update, { new: true })
        .lean()
        .exec();
    } catch (error: any) {
      logger.error('Error updating assignment status', { assignmentId, error: error.message });
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

      const assignments = await DrillAssignment.find(query)
        .populate('learnerId', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
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
      const query: any = { learnerId: new Types.ObjectId(learnerId) };
      
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
        .populate('drillId', 'title type difficulty date duration_days context audio_example_url')
        .populate('assignedBy', 'firstName lastName email')
        .sort({ assignedAt: -1 })
        .limit(filters?.limit || 20)
        .skip(filters?.offset || 0)
        .lean()
        .exec();

      const total = await DrillAssignment.countDocuments(query).exec();

      return { assignments, total };
    } catch (error: any) {
      logger.error('Error finding assignments by learner ID', { learnerId, error: error.message });
      throw error;
    }
  }
}

