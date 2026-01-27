import PronunciationAssignmentModel from '@/models/pronunciation-assignment';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';

export interface PronunciationAssignment {
  _id: Types.ObjectId;
  pronunciationId: Types.ObjectId;
  learnerId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  dueDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
  completedAt?: Date;
  attemptsCount: number;
  bestScore?: number;
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePronunciationAssignmentData {
  pronunciationId: Types.ObjectId;
  learnerId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  dueDate?: Date;
  status?: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
}

/**
 * Repository for pronunciation assignment data access
 */
export class PronunciationAssignmentRepository {
  /**
   * Find assignment by ID
   */
  async findById(id: string | Types.ObjectId): Promise<PronunciationAssignment | null> {
    try {
      const assignment = await PronunciationAssignmentModel.findById(id)
        .populate('pronunciationId')
        .populate('learnerId', 'email firstName lastName')
        .populate('assignedBy', 'email firstName lastName')
        .lean()
        .exec();
      return assignment as PronunciationAssignment | null;
    } catch (error: any) {
      logger.error('Error finding pronunciation assignment by ID', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Find assignments with filters
   */
  async findMany(filters: {
    pronunciationId?: string;
    learnerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PronunciationAssignment[]> {
    try {
      const query: any = {};

      if (filters.pronunciationId) {
        query.pronunciationId = new Types.ObjectId(filters.pronunciationId);
      }

      if (filters.learnerId) {
        query.learnerId = new Types.ObjectId(filters.learnerId);
      }

      if (filters.status) {
        query.status = filters.status;
      }

      const assignments = await PronunciationAssignmentModel.find(query)
        .populate('pronunciationId')
        .populate('learnerId', 'email firstName lastName')
        .populate('assignedBy', 'email firstName lastName')
        .sort({ assignedAt: -1 })
        .limit(filters.limit || 100)
        .skip(filters.offset || 0)
        .lean()
        .exec();

      return assignments as PronunciationAssignment[];
    } catch (error: any) {
      logger.error('Error finding pronunciation assignments', { filters, error: error.message });
      throw error;
    }
  }

  /**
   * Find existing assignments to prevent duplicates
   */
  async findExisting(
    pronunciationId: string | Types.ObjectId,
    learnerIds: string[]
  ): Promise<Set<string>> {
    try {
      const assignments = await PronunciationAssignmentModel.find({
        pronunciationId: new Types.ObjectId(pronunciationId),
        learnerId: { $in: learnerIds.map(id => new Types.ObjectId(id)) },
      })
        .select('learnerId')
        .lean()
        .exec();

      return new Set(assignments.map(a => a.learnerId.toString()));
    } catch (error: any) {
      logger.error('Error finding existing pronunciation assignments', {
        pronunciationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a single assignment
   */
  async create(data: CreatePronunciationAssignmentData): Promise<PronunciationAssignment> {
    try {
      const assignment = await PronunciationAssignmentModel.create(data);
      return assignment.toObject() as PronunciationAssignment;
    } catch (error: any) {
      logger.error('Error creating pronunciation assignment', { data, error: error.message });
      throw error;
    }
  }

  /**
   * Create multiple assignments in bulk
   */
  async createBulk(data: CreatePronunciationAssignmentData[]): Promise<PronunciationAssignment[]> {
    try {
      const assignments = await PronunciationAssignmentModel.insertMany(data, {
        ordered: false, // Continue even if some fail
      });
      return assignments.map(a => a.toObject()) as PronunciationAssignment[];
    } catch (error: any) {
      logger.error('Error creating bulk pronunciation assignments', {
        count: data.length,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update assignment status
   */
  async updateStatus(
    assignmentId: string | Types.ObjectId,
    status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped',
    completedAt?: Date
  ): Promise<void> {
    try {
      const update: any = { status };
      if (completedAt) {
        update.completedAt = completedAt;
      }
      await PronunciationAssignmentModel.findByIdAndUpdate(assignmentId, update).exec();
    } catch (error: any) {
      logger.error('Error updating pronunciation assignment status', {
        assignmentId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update assignment attempt stats
   */
  async updateAttemptStats(
    assignmentId: string | Types.ObjectId,
    stats: {
      attemptsCount?: number;
      bestScore?: number;
      lastAttemptAt?: Date;
    }
  ): Promise<void> {
    try {
      await PronunciationAssignmentModel.findByIdAndUpdate(assignmentId, {
        $set: stats,
        $inc: { attemptsCount: stats.attemptsCount ? 0 : 1 }, // Increment if not explicitly set
      }).exec();
    } catch (error: any) {
      logger.error('Error updating pronunciation assignment stats', {
        assignmentId,
        stats,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find assignment by pronunciation and learner
   */
  async findByPronunciationAndLearner(
    pronunciationId: string | Types.ObjectId,
    learnerId: string | Types.ObjectId
  ): Promise<PronunciationAssignment | null> {
    try {
      const assignment = await PronunciationAssignmentModel.findOne({
        pronunciationId: new Types.ObjectId(pronunciationId),
        learnerId: new Types.ObjectId(learnerId),
      })
        .lean()
        .exec();
      return assignment as PronunciationAssignment | null;
    } catch (error: any) {
      logger.error('Error finding pronunciation assignment', {
        pronunciationId,
        learnerId,
        error: error.message,
      });
      throw error;
    }
  }
}

