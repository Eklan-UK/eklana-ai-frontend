import DrillAttempt from '@/models/drill-attempt';
import User from '@/models/user';
import Drill from '@/models/drill';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';

export interface CreateAttemptData {
  drillAssignmentId: Types.ObjectId;
  learnerId: Types.ObjectId;
  drillId: Types.ObjectId;
  startedAt: Date;
  completedAt: Date;
  timeSpent: number;
  score: number;
  maxScore: number;
  vocabularyResults?: any;
  roleplayResults?: any;
  matchingResults?: any;
  definitionResults?: any;
  grammarResults?: any;
  sentenceWritingResults?: any;
  sentenceResults?: any;
  summaryResults?: any;
  listeningResults?: any;
  deviceInfo?: string;
  platform?: 'web' | 'ios' | 'android';
}

/**
 * Repository for drill attempt data access
 */
export class AttemptRepository {
  /**
   * Create a new drill attempt
   */
  async create(data: CreateAttemptData): Promise<any> {
    try {
      const attempt = await DrillAttempt.create(data);
      return attempt.toObject();
    } catch (error: any) {
      logger.error('Error creating drill attempt', { error: error.message });
      throw error;
    }
  }

  /**
   * Find attempts by assignment ID
   */
  async findByAssignmentId(assignmentId: string): Promise<any[]> {
    try {
      return await DrillAttempt.find({
        drillAssignmentId: new Types.ObjectId(assignmentId),
      })
        .sort({ completedAt: -1 })
        .lean()
        .exec();
    } catch (error: any) {
      logger.error('Error finding attempts by assignment', { assignmentId, error: error.message });
      throw error;
    }
  }

  /**
   * Find attempts by learner ID
   */
  async findByLearnerId(learnerId: string, filters?: { limit?: number; offset?: number }): Promise<any[]> {
    try {
      const queryBuilder = DrillAttempt.find({
        learnerId: new Types.ObjectId(learnerId),
      })
        .sort({ completedAt: -1 });

      if (filters?.limit) {
        queryBuilder.limit(filters.limit);
      }
      if (filters?.offset) {
        queryBuilder.skip(filters.offset);
      }

      return queryBuilder.lean().exec();
    } catch (error: any) {
      logger.error('Error finding attempts by learner', { learnerId, error: error.message });
      throw error;
    }
  }

  /**
   * Get latest attempts for multiple assignments using aggregation
   */
  async getLatestAttemptsForAssignments(assignmentIds: string[]): Promise<Map<string, any>> {
    try {
      const latestAttempts = await DrillAttempt.aggregate([
        {
          $match: {
            drillAssignmentId: { $in: assignmentIds.map(id => new Types.ObjectId(id)) },
          },
        },
        {
          $sort: { completedAt: -1, createdAt: -1 },
        },
        {
          $group: {
            _id: '$drillAssignmentId',
            latestAttempt: { $first: '$$ROOT' },
          },
        },
      ]);

      const attemptMap = new Map(
        latestAttempts.map((item) => {
          const attempt = item.latestAttempt;
          
          // Determine review status and correct/incorrect counts
          let reviewInfo: {
            reviewStatus?: string;
            correctCount?: number;
            totalCount?: number;
          } = {};
          
          // Check for sentence drill review
          if (attempt.sentenceResults) {
            reviewInfo.reviewStatus = attempt.sentenceResults.reviewStatus || 'pending';
            
            let totalSentences = 0;
            if (attempt.sentenceResults.words?.length > 0) {
              totalSentences = attempt.sentenceResults.words.reduce(
                (acc: number, w: any) => acc + (w.sentences?.length || 0),
                0
              );
            } else {
              totalSentences = attempt.sentenceResults.sentences?.length || 2;
            }
            
            if (attempt.sentenceResults.sentenceReviews?.length > 0) {
              reviewInfo.correctCount = attempt.sentenceResults.sentenceReviews.filter(
                (r: any) => r.isCorrect
              ).length;
              reviewInfo.totalCount = totalSentences;
            } else {
              reviewInfo.correctCount = 0;
              reviewInfo.totalCount = totalSentences;
            }
          }
          
          // Check for grammar drill review
          if (attempt.grammarResults?.patterns) {
            reviewInfo.reviewStatus = attempt.grammarResults.reviewStatus || 'pending';
            if (attempt.grammarResults.patternReviews?.length > 0) {
              reviewInfo.correctCount = attempt.grammarResults.patternReviews.filter(
                (r: any) => r.isCorrect
              ).length;
              reviewInfo.totalCount = attempt.grammarResults.patterns.reduce(
                (acc: number, p: any) => acc + (p.sentences?.length || 0),
                0
              );
            } else {
              reviewInfo.correctCount = 0;
              reviewInfo.totalCount = attempt.grammarResults.patterns.reduce(
                (acc: number, p: any) => acc + (p.sentences?.length || 0),
                0
              );
            }
          }
          
          // Check for summary drill review
          if (attempt.summaryResults?.summaryProvided) {
            reviewInfo.reviewStatus = attempt.summaryResults.reviewStatus || 'pending';
            if (attempt.summaryResults.review) {
              reviewInfo.correctCount = attempt.summaryResults.review.isAcceptable ? 1 : 0;
              reviewInfo.totalCount = 1;
            } else {
              reviewInfo.correctCount = 0;
              reviewInfo.totalCount = 1;
            }
          }
          
          return [
            item._id.toString(),
            {
              score: attempt.score,
              timeSpent: attempt.timeSpent,
              completedAt: attempt.completedAt,
              ...reviewInfo,
            },
          ];
        })
      );

      return attemptMap;
    } catch (error: any) {
      logger.error('Error getting latest attempts for assignments', { error: error.message });
      throw error;
    }
  }

  /**
   * Get sentence drill submissions for review
   */
  async getSentenceSubmissions(filters: {
    status?: 'pending' | 'reviewed' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ attempts: any[]; total: number }> {
    try {
      const query: Record<string, any> = {
        sentenceResults: { $exists: true, $ne: null },
      };

      if (filters.status === 'pending') {
        query['sentenceResults.reviewStatus'] = 'pending';
      } else if (filters.status === 'reviewed') {
        query['sentenceResults.reviewStatus'] = 'reviewed';
      }

      const attempts = await DrillAttempt.find(query)
        .populate({ path: 'learnerId', model: User, select: 'firstName lastName email' })
        .populate({ path: 'drillId', model: Drill, select: 'title type sentence_drill_word sentence_writing_items' })
        .sort({ completedAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0)
        .lean()
        .exec();

      const total = await DrillAttempt.countDocuments(query).exec();

      return { attempts, total };
    } catch (error: any) {
      logger.error('Error getting sentence submissions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get grammar drill submissions for review
   */
  async getGrammarSubmissions(filters: {
    status?: 'pending' | 'reviewed' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ attempts: any[]; total: number }> {
    try {
      const query: Record<string, any> = {
        'grammarResults.patterns': { $exists: true, $ne: null, $not: { $size: 0 } },
      };

      if (filters.status === 'pending') {
        query['grammarResults.reviewStatus'] = 'pending';
      } else if (filters.status === 'reviewed') {
        query['grammarResults.reviewStatus'] = 'reviewed';
      }

      const attempts = await DrillAttempt.find(query)
        .populate({ path: 'learnerId', model: User, select: 'firstName lastName email' })
        .populate({ path: 'drillId', model: Drill, select: 'title type grammar_items' })
        .sort({ completedAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0)
        .lean()
        .exec();

      const total = await DrillAttempt.countDocuments(query).exec();

      return { attempts, total };
    } catch (error: any) {
      logger.error('Error getting grammar submissions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get summary drill submissions for review
   */
  async getSummarySubmissions(filters: {
    status?: 'pending' | 'reviewed' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ attempts: any[]; total: number }> {
    try {
      const query: Record<string, any> = {
        summaryResults: { $exists: true, $ne: null },
        'summaryResults.summaryProvided': true,
      };

      if (filters.status === 'pending') {
        query['summaryResults.reviewStatus'] = { $in: ['pending', null] };
      } else if (filters.status === 'reviewed') {
        query['summaryResults.reviewStatus'] = 'reviewed';
      }

      const attempts = await DrillAttempt.find(query)
        .populate({ path: 'learnerId', model: User, select: 'firstName lastName email' })
        .populate({ path: 'drillId', model: Drill, select: 'title type article_title' })
        .sort({ completedAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0)
        .lean()
        .exec();

      const total = await DrillAttempt.countDocuments(query).exec();

      return { attempts, total };
    } catch (error: any) {
      logger.error('Error getting summary submissions', { error: error.message });
      throw error;
    }
  }
}

