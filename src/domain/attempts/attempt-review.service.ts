import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import { AttemptRepository } from './attempt.repository';
import { DrillRepository } from '../drills/drill.repository';
import { AssignmentRepository } from '../assignments/assignment.repository';
import { userService } from '@/lib/api/user.service';
import { NotFoundError, ValidationError } from '@/lib/api/response';
import { sendDrillReviewNotification } from '@/lib/api/email.service';
import { onDrillReviewed } from '@/services/notification/triggers';
import DrillAttempt from '@/models/drill-attempt';
import DrillAssignment from '@/models/drill-assignment';

export interface SentenceReview {
  sentenceIndex: number;
  isCorrect: boolean;
  correctedText?: string;
}

export interface GrammarReview {
  patternIndex: number;
  sentenceIndex: number;
  isCorrect: boolean;
  correctedText?: string;
}

export interface SummaryReview {
  feedback?: string;
  isAcceptable: boolean;
  correctedVersion?: string;
}

/**
 * Service for reviewing drill attempts
 */
export class AttemptReviewService {
  constructor(
    private attemptRepo: AttemptRepository,
    private drillRepo: DrillRepository,
    private assignmentRepo: AssignmentRepository
  ) {}

  /**
   * Review a sentence drill attempt
   */
  async reviewSentenceAttempt(
    attemptId: string,
    reviewerId: string,
    reviews: SentenceReview[]
  ): Promise<any> {
    const attemptDoc = await DrillAttempt.findById(attemptId)
      .populate('drillId', 'type')
      .exec();
    
    if (!attemptDoc) {
      throw new NotFoundError('Attempt');
    }

    // Verify it's a sentence drill
    const drillType = (attemptDoc.drillId as any)?.type;
    if (drillType && drillType !== 'sentence' && drillType !== 'sentence_writing') {
      throw new ValidationError('This endpoint is only for sentence drills');
    }

    if (!attemptDoc.sentenceResults) {
      throw new ValidationError('This attempt does not have sentence results');
    }

    // Calculate score
    const correctCount = reviews.filter((r) => r.isCorrect).length;
    const totalSentences = reviews.length;
    const score = Math.round((correctCount / totalSentences) * 100);

    // Update attempt
    const sentenceReviews = reviews.map((review) => ({
      sentenceIndex: review.sentenceIndex,
      isCorrect: review.isCorrect,
      correctedText: review.isCorrect ? undefined : review.correctedText,
      reviewedAt: new Date(),
      reviewedBy: new Types.ObjectId(reviewerId),
    }));

    attemptDoc.sentenceResults.reviewStatus = 'reviewed';
    attemptDoc.sentenceResults.sentenceReviews = sentenceReviews;
    attemptDoc.score = score;
    await attemptDoc.save();

    // Send notifications
    await this.sendReviewNotifications(attemptDoc, reviewerId, {
      score,
      allCorrect: correctCount === totalSentences,
    });

    const updated = await DrillAttempt.findById(attemptId)
      .populate('drillId', 'title type')
      .populate('learnerId', 'firstName lastName email')
      .lean()
      .exec();

    return updated;
  }

  /**
   * Review a grammar drill attempt
   */
  async reviewGrammarAttempt(
    attemptId: string,
    reviewerId: string,
    reviews: GrammarReview[]
  ): Promise<any> {
    const attemptDoc = await DrillAttempt.findById(attemptId)
      .populate('drillId', 'type')
      .exec();

    if (!attemptDoc) {
      throw new NotFoundError('Attempt');
    }

    // Verify it's a grammar drill
    const drillType = (attemptDoc.drillId as any)?.type;
    if (drillType && drillType !== 'grammar') {
      throw new ValidationError('This endpoint is only for grammar drills');
    }

    if (!attemptDoc.grammarResults || !attemptDoc.grammarResults.patterns) {
      throw new ValidationError('This attempt does not have grammar pattern results');
    }

    // Calculate score
    const correctCount = reviews.filter((r) => r.isCorrect).length;
    const totalReviews = reviews.length;
    const score = Math.round((correctCount / totalReviews) * 100);

    // Update attempt
    const patternReviews = reviews.map((review) => ({
      patternIndex: review.patternIndex,
      sentenceIndex: review.sentenceIndex,
      isCorrect: review.isCorrect,
      correctedText: review.isCorrect ? undefined : review.correctedText,
      reviewedAt: new Date(),
      reviewedBy: new Types.ObjectId(reviewerId),
    }));

    attemptDoc.grammarResults.reviewStatus = 'reviewed';
    attemptDoc.grammarResults.patternReviews = patternReviews;
    attemptDoc.score = score;
    await attemptDoc.save();

    // Send notifications
    await this.sendReviewNotifications(attemptDoc, reviewerId, {
      score,
      allCorrect: correctCount === totalReviews,
    });

    const updated = await DrillAttempt.findById(attemptId)
      .populate('drillId', 'title type')
      .populate('learnerId', 'firstName lastName email')
      .lean()
      .exec();

    return updated;
  }

  /**
   * Review a summary drill attempt
   */
  async reviewSummaryAttempt(
    attemptId: string,
    reviewerId: string,
    review: SummaryReview
  ): Promise<any> {
    const attemptDoc = await DrillAttempt.findById(attemptId)
      .populate('drillId', 'type')
      .exec();

    if (!attemptDoc) {
      throw new NotFoundError('Attempt');
    }

    // Verify it's a summary drill
    const drillType = (attemptDoc.drillId as any)?.type;
    if (drillType && drillType !== 'summary') {
      throw new ValidationError('This endpoint is only for summary drills');
    }

    if (!attemptDoc.summaryResults) {
      throw new ValidationError('This attempt does not have summary results');
    }

    // Update attempt
    attemptDoc.summaryResults.reviewStatus = 'reviewed';
    attemptDoc.summaryResults.review = {
      feedback: review.feedback,
      isAcceptable: review.isAcceptable,
      correctedVersion: review.correctedVersion,
      reviewedAt: new Date(),
      reviewedBy: new Types.ObjectId(reviewerId),
    };
    attemptDoc.score = review.isAcceptable ? 100 : 0;
    await attemptDoc.save();

    // Send notifications
    await this.sendReviewNotifications(attemptDoc, reviewerId, {
      score: attemptDoc.score,
      allCorrect: review.isAcceptable,
    });

    const updated = await DrillAttempt.findById(attemptId)
      .populate('drillId', 'title type')
      .populate('learnerId', 'firstName lastName email')
      .lean()
      .exec();

    return updated;
  }

  /**
   * Send review notifications
   */
  private async sendReviewNotifications(
    attempt: any,
    reviewerId: string,
    feedback: { score: number; allCorrect: boolean }
  ): Promise<void> {
    try {
      const reviewer = await userService.findById(reviewerId, 'firstName lastName email name');
      const learner = await userService.findById(
        attempt.learnerId.toString(),
        'firstName lastName email name'
      );
      const drill = await this.drillRepo.findById(attempt.drillId.toString());

      if (!drill || !learner.email) return;

      const tutorName = userService.getDisplayName(reviewer);

      // Send email notification
      await sendDrillReviewNotification({
        studentEmail: learner.email,
        studentName: learner.firstName || 'Student',
        drillTitle: drill.title,
        drillType: drill.type,
        tutorName,
        score: feedback.score,
        correctCount: feedback.allCorrect ? 1 : 0,
        totalCount: 1,
      }).catch((err) => {
        logger.error('Failed to send review email notification', { error: err.message });
      });

      // Send push notification
      const assignment = await this.assignmentRepo.findMany({
        learnerId: learner._id.toString(),
        drillId: drill._id.toString(),
        limit: 1,
      });

      if (assignment.length > 0) {
        await onDrillReviewed(
          learner._id.toString(),
          {
            _id: drill._id.toString(),
            title: drill.title,
          },
          assignment[0]._id.toString(),
          feedback
        ).catch((err) => {
          logger.error('Failed to send review push notification', { error: err.message });
        });
      }
    } catch (error: any) {
      logger.error('Error sending review notifications', { error: error.message });
    }
  }
}

