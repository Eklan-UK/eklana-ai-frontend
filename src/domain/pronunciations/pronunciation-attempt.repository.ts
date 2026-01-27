import PronunciationAttemptModel from '@/models/pronunciation-attempt';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';

export interface PronunciationAttempt {
  _id: Types.ObjectId;
  pronunciationAssignmentId?: Types.ObjectId;
  pronunciationId?: Types.ObjectId;
  learnerId: Types.ObjectId;
  textScore: number;
  fluencyScore?: number;
  passed: boolean;
  passingThreshold: number;
  wordScores: Array<{
    word: string;
    score: number;
    phonemes?: Array<{
      phoneme: string;
      score: number;
    }>;
  }>;
  incorrectLetters?: string[];
  incorrectPhonemes?: string[];
  audioUrl?: string;
  audioDuration?: number;
  textFeedback?: string;
  wordFeedback?: Array<{
    word: string;
    feedback: string;
  }>;
  attemptNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePronunciationAttemptData {
  pronunciationAssignmentId?: Types.ObjectId;
  pronunciationId?: Types.ObjectId;
  learnerId: Types.ObjectId;
  textScore: number;
  fluencyScore?: number;
  passed: boolean;
  passingThreshold: number;
  wordScores: Array<{
    word: string;
    score: number;
    phonemes?: Array<{
      phoneme: string;
      score: number;
    }>;
  }>;
  incorrectLetters?: string[];
  incorrectPhonemes?: string[];
  audioUrl?: string;
  audioDuration?: number;
  textFeedback?: string;
  wordFeedback?: Array<{
    word: string;
    feedback: string;
  }>;
  attemptNumber: number;
}

/**
 * Repository for pronunciation attempt data access
 */
export class PronunciationAttemptRepository {
  /**
   * Create a new pronunciation attempt
   */
  async create(data: CreatePronunciationAttemptData): Promise<PronunciationAttempt> {
    try {
      const attempt = await PronunciationAttemptModel.create(data);
      return attempt.toObject() as PronunciationAttempt;
    } catch (error: any) {
      logger.error('Error creating pronunciation attempt', { data, error: error.message });
      throw error;
    }
  }

  /**
   * Find attempts by assignment ID
   */
  async findByAssignmentId(
    assignmentId: string | Types.ObjectId,
    filters?: { limit?: number; offset?: number }
  ): Promise<{ attempts: PronunciationAttempt[]; total: number }> {
    try {
      const attempts = await PronunciationAttemptModel.find({
        pronunciationAssignmentId: new Types.ObjectId(assignmentId),
      })
        .sort({ attemptNumber: 1 })
        .limit(filters?.limit || 50)
        .skip(filters?.offset || 0)
        .lean()
        .exec();

      const total = await PronunciationAttemptModel.countDocuments({
        pronunciationAssignmentId: new Types.ObjectId(assignmentId),
      }).exec();

      return {
        attempts: attempts as PronunciationAttempt[],
        total,
      };
    } catch (error: any) {
      logger.error('Error finding pronunciation attempts by assignment', {
        assignmentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find attempts by learner ID
   */
  async findByLearnerId(
    learnerId: string | Types.ObjectId,
    filters?: { limit?: number; offset?: number }
  ): Promise<PronunciationAttempt[]> {
    try {
      const queryBuilder = PronunciationAttemptModel.find({
        learnerId: new Types.ObjectId(learnerId),
      }).sort({ createdAt: -1 });

      if (filters?.limit) {
        queryBuilder.limit(filters.limit);
      }
      if (filters?.offset) {
        queryBuilder.skip(filters.offset);
      }

      return queryBuilder.lean().exec() as Promise<PronunciationAttempt[]>;
    } catch (error: any) {
      logger.error('Error finding pronunciation attempts by learner', {
        learnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get next attempt number for an assignment
   */
  async getNextAttemptNumber(assignmentId: string | Types.ObjectId): Promise<number> {
    try {
      const lastAttempt = await PronunciationAttemptModel.findOne({
        pronunciationAssignmentId: new Types.ObjectId(assignmentId),
      })
        .sort({ attemptNumber: -1 })
        .select('attemptNumber')
        .lean()
        .exec();

      return lastAttempt ? (lastAttempt.attemptNumber as number) + 1 : 1;
    } catch (error: any) {
      logger.error('Error getting next attempt number', { assignmentId, error: error.message });
      throw error;
    }
  }
}

