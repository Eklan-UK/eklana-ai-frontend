import Drill from '@/models/drill';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import type { Drill as DrillType, CreateDrillData } from './drill.types';

/**
 * Repository for drill data access
 * Abstracts database operations for drills
 */
export class DrillRepository {
  /**
   * Find drill by ID
   */
  async findById(drillId: string): Promise<DrillType | null> {
    try {
      return await Drill.findById(drillId).lean().exec();
    } catch (error: any) {
      logger.error('Error finding drill by ID', { drillId, error: error.message });
      throw error;
    }
  }

  /**
   * Find drill by ID or throw error
   */
  async findByIdOrThrow(drillId: string): Promise<DrillType> {
    const drill = await this.findById(drillId);
    if (!drill) {
      throw new Error(`Drill with ID ${drillId} not found`);
    }
    return drill;
  }

  /**
   * Find drills by creator
   */
  async findByCreator(
    creatorId: string,
    filters?: {
      type?: string;
      difficulty?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<DrillType[]> {
    const query: any = {
      createdById: new Types.ObjectId(creatorId),
    };

    if (filters?.type) query.type = filters.type;
    if (filters?.difficulty) query.difficulty = filters.difficulty;
    if (filters?.isActive !== undefined) query.is_active = filters.isActive;

    const queryBuilder = Drill.find(query).sort({ created_date: -1 });

    if (filters?.limit) {
      queryBuilder.limit(filters.limit);
    }
    if (filters?.offset) {
      queryBuilder.skip(filters.offset);
    }

    return queryBuilder.lean().exec();
  }

  /**
   * Find drills by type
   */
  async findByType(type: string, filters?: any): Promise<DrillType[]> {
    const query: any = { type, is_active: true };
    if (filters?.difficulty) query.difficulty = filters.difficulty;

    return Drill.find(query)
      .sort({ created_date: -1 })
      .lean()
      .exec();
  }

  /**
   * Find drills with filters
   */
  async findMany(filters: {
    type?: string;
    difficulty?: string;
    studentEmail?: string;
    createdBy?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<DrillType[]> {
    const query: any = {};

    if (filters.type) query.type = filters.type;
    if (filters.difficulty) query.difficulty = filters.difficulty;
    if (filters.isActive !== undefined) query.is_active = filters.isActive;
    if (filters.createdBy) query.created_by = filters.createdBy;
    if (filters.studentEmail) query.assigned_to = filters.studentEmail;

    const queryBuilder = Drill.find(query)
      .select('title type difficulty date duration_days context audio_example_url created_date is_active assigned_to createdById created_by')
      .sort({ created_date: -1 });

    if (filters.limit) {
      queryBuilder.limit(filters.limit);
    }
    if (filters.offset) {
      queryBuilder.skip(filters.offset);
    }

    return queryBuilder.lean().exec();
  }

  /**
   * Create a new drill
   */
  async create(data: CreateDrillData): Promise<DrillType> {
    try {
      const drill = await Drill.create(data);
      return drill.toObject();
    } catch (error: any) {
      logger.error('Error creating drill', { error: error.message });
      throw error;
    }
  }

  /**
   * Update drill
   */
  async update(drillId: string, data: Partial<CreateDrillData>): Promise<DrillType | null> {
    try {
      const drill = await Drill.findByIdAndUpdate(
        drillId,
        { ...data, updated_date: new Date() },
        { new: true }
      ).lean().exec();
      return drill;
    } catch (error: any) {
      logger.error('Error updating drill', { drillId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete drill
   */
  async delete(drillId: string): Promise<boolean> {
    try {
      const result = await Drill.findByIdAndDelete(drillId).exec();
      return !!result;
    } catch (error: any) {
      logger.error('Error deleting drill', { drillId, error: error.message });
      throw error;
    }
  }

  /**
   * Increment assignment count
   */
  async incrementAssignments(drillId: string, count: number): Promise<void> {
    try {
      await Drill.findByIdAndUpdate(drillId, {
        $inc: { totalAssignments: count },
      }).exec();
    } catch (error: any) {
      logger.error('Error incrementing assignments', { drillId, error: error.message });
      throw error;
    }
  }

  /**
   * Count drills
   */
  async count(filter?: any): Promise<number> {
    return Drill.countDocuments(filter || {}).exec();
  }
}

