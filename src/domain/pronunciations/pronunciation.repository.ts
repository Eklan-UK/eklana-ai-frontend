import PronunciationModel from '@/models/pronunciation';
import { Pronunciation, CreatePronunciationData, PronunciationQueryFilters } from './pronunciation.types';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';

/**
 * Repository for pronunciation data access
 */
export class PronunciationRepository {
  /**
   * Find pronunciation by ID
   */
  async findById(id: string | Types.ObjectId): Promise<Pronunciation | null> {
    try {
      const pronunciation = await PronunciationModel.findById(id)
        .populate('createdBy', 'email firstName lastName')
        .lean()
        .exec();
      return pronunciation as Pronunciation | null;
    } catch (error: any) {
      logger.error('Error finding pronunciation by ID', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Find all pronunciations with optional filters
   */
  async findAll(filters?: PronunciationQueryFilters): Promise<Pronunciation[]> {
    try {
      const query: any = {};

      if (filters?.difficulty) {
        query.difficulty = filters.difficulty;
      }

      if (filters?.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      if (filters?.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { text: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
        ];
      }

      const pronunciations = await PronunciationModel.find(query)
        .populate('createdBy', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .limit(filters?.limit || 100)
        .skip(filters?.offset || 0)
        .lean()
        .exec();

      return pronunciations as Pronunciation[];
    } catch (error: any) {
      logger.error('Error finding pronunciations', { filters, error: error.message });
      throw error;
    }
  }

  /**
   * Count pronunciations with filters
   */
  async countDocuments(filters?: PronunciationQueryFilters): Promise<number> {
    try {
      const query: any = {};

      if (filters?.difficulty) {
        query.difficulty = filters.difficulty;
      }

      if (filters?.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      if (filters?.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { text: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
        ];
      }

      return PronunciationModel.countDocuments(query).exec();
    } catch (error: any) {
      logger.error('Error counting pronunciations', { filters, error: error.message });
      throw error;
    }
  }

  /**
   * Create a new pronunciation
   */
  async create(data: CreatePronunciationData & { createdBy: Types.ObjectId }): Promise<Pronunciation> {
    try {
      const pronunciation = await PronunciationModel.create(data);
      await pronunciation.populate('createdBy', 'email firstName lastName');
      return pronunciation.toObject() as Pronunciation;
    } catch (error: any) {
      logger.error('Error creating pronunciation', { data, error: error.message });
      throw error;
    }
  }

  /**
   * Update pronunciation
   */
  async update(
    id: string | Types.ObjectId,
    data: Partial<CreatePronunciationData>
  ): Promise<Pronunciation | null> {
    try {
      const pronunciation = await PronunciationModel.findByIdAndUpdate(
        id,
        { ...data, updatedAt: new Date() },
        { new: true, runValidators: true }
      )
        .populate('createdBy', 'email firstName lastName')
        .lean()
        .exec();

      return pronunciation as Pronunciation | null;
    } catch (error: any) {
      logger.error('Error updating pronunciation', { id, data, error: error.message });
      throw error;
    }
  }

  /**
   * Delete pronunciation
   */
  async delete(id: string | Types.ObjectId): Promise<boolean> {
    try {
      const result = await PronunciationModel.findByIdAndDelete(id).exec();
      return !!result;
    } catch (error: any) {
      logger.error('Error deleting pronunciation', { id, error: error.message });
      throw error;
    }
  }
}

