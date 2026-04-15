import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import { PronunciationRepository } from './pronunciation.repository';
import { PronunciationAssignmentRepository } from './pronunciation-assignment.repository';
import { PronunciationAttemptRepository } from './pronunciation-attempt.repository';
import { userService } from '@/lib/api/user.service';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/api/response';
import { speechaceService } from '@/lib/api/speechace.service';
import { uploadToCloudinary } from '@/services/cloudinary.service';
import type {
  Pronunciation,
  CreatePronunciationData,
  PronunciationQueryFilters,
  AssignPronunciationParams,
  SubmitPronunciationAttemptParams,
} from './pronunciation.types';

/**
 * Service for pronunciation business logic
 */
export class PronunciationService {
  constructor(
    private pronunciationRepo: PronunciationRepository,
    private assignmentRepo: PronunciationAssignmentRepository,
    private attemptRepo: PronunciationAttemptRepository
  ) {}

  /**
   * List pronunciations with filters
   */
  async listPronunciations(
    filters: PronunciationQueryFilters
  ): Promise<{ pronunciations: Pronunciation[]; total: number; limit: number; offset: number }> {
    const pronunciations = await this.pronunciationRepo.findAll(filters);
    const total = await this.pronunciationRepo.countDocuments(filters);

    return {
      pronunciations,
      total,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
    };
  }

  /**
   * Create a new pronunciation
   */
  async createPronunciation(
    data: CreatePronunciationData & { audioFile?: File },
    createdById: string
  ): Promise<Pronunciation> {
    // Validate required fields
    if (!data.title || !data.text) {
      throw new ValidationError('Title and text are required');
    }

    // Upload audio file if provided
    let audioUrl: string | undefined;
    let audioFileName: string | undefined;
    const useTTS = !data.audioFile;

    if (data.audioFile) {
      try {
        const arrayBuffer = await data.audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadResult = await uploadToCloudinary(buffer, {
          folder: 'eklan/pronunciations/audio',
          publicId: `pronunciation_${Date.now()}_${createdById}`,
          resourceType: 'raw',
        });
        audioUrl = uploadResult.secureUrl;
        audioFileName = data.audioFile.name;
      } catch (error: any) {
        logger.error('Failed to upload pronunciation audio', { error: error.message });
        throw new ValidationError('Failed to upload audio file');
      }
    }

    // Create pronunciation
    const pronunciation = await this.pronunciationRepo.create({
      ...data,
      audioUrl,
      audioFileName,
      useTTS,
      createdBy: new Types.ObjectId(createdById),
      isActive: data.isActive ?? true,
    });

    logger.info('Pronunciation created successfully', {
      pronunciationId: pronunciation._id,
      createdBy: createdById,
    });

    return pronunciation;
  }

  /**
   * Assign pronunciation to learners
   */
  async assignPronunciation(params: AssignPronunciationParams): Promise<{
    assignments: any[];
    skipped: number;
    total: number;
  }> {
    // 1. Validate pronunciation exists
    const pronunciation = await this.pronunciationRepo.findById(params.pronunciationId);
    if (!pronunciation) {
      throw new NotFoundError('Pronunciation');
    }

    // 2. Validate all users exist and are learners
    const users = await userService.findMultipleWithRole(
      params.learnerIds,
      'user',
      'email firstName lastName'
    );

    if (users.length !== params.learnerIds.length) {
      throw new ValidationError('One or more user IDs are invalid or not learners');
    }

    // 3. Check for existing assignments
    const existingUserIds = await this.assignmentRepo.findExisting(
      params.pronunciationId,
      params.learnerIds
    );

    // 4. Filter out users who already have assignments
    const usersToAssign = users.filter(
      (u) => !existingUserIds.has(u._id.toString())
    );

    if (usersToAssign.length === 0) {
      return {
        assignments: [],
        skipped: params.learnerIds.length,
        total: 0,
      };
    }

    // 5. Create assignments in bulk
    const assignmentsToCreate = usersToAssign.map((user) => ({
      pronunciationId: new Types.ObjectId(params.pronunciationId),
      learnerId: new Types.ObjectId(user._id.toString()),
      assignedBy: new Types.ObjectId(params.assignedBy),
      dueDate: params.dueDate,
      status: 'pending' as const,
    }));

    const createdAssignments = await this.assignmentRepo.createBulk(assignmentsToCreate);

    logger.info('Pronunciation assignments created', {
      pronunciationId: params.pronunciationId,
      assigned: createdAssignments.length,
      skipped: params.learnerIds.length - createdAssignments.length,
    });

    return {
      assignments: createdAssignments,
      skipped: params.learnerIds.length - createdAssignments.length,
      total: createdAssignments.length,
    };
  }

  /**
   * Submit a pronunciation attempt
   */
  async submitAttempt(params: SubmitPronunciationAttemptParams): Promise<{
    attempt: any;
    assignment: any;
  }> {
    // 1. Validate pronunciation exists
    const pronunciation = await this.pronunciationRepo.findById(params.pronunciationId);
    if (!pronunciation) {
      throw new NotFoundError('Pronunciation');
    }

    // 2. Find or create assignment
    let assignment = await this.assignmentRepo.findByPronunciationAndLearner(
      params.pronunciationId,
      params.learnerId
    );

    if (!assignment) {
      // Create assignment if it doesn't exist
      assignment = await this.assignmentRepo.create({
        pronunciationId: new Types.ObjectId(params.pronunciationId),
        learnerId: new Types.ObjectId(params.learnerId),
        assignedBy: new Types.ObjectId(params.learnerId), // Self-assigned
        status: 'in-progress',
      });
    }

    // 3. Upload audio recording
    let audioUrl: string | undefined;
    try {
      let cleanAudioBase64 = params.audioBase64;
      if (cleanAudioBase64.includes(',')) {
        cleanAudioBase64 = cleanAudioBase64.split(',')[1];
      }

      const audioBuffer = Buffer.from(cleanAudioBase64, 'base64');
      const uploadResult = await uploadToCloudinary(audioBuffer, {
        folder: 'eklan/pronunciations/attempts',
        publicId: `attempt_${Date.now()}_${params.learnerId}`,
        resourceType: 'raw',
      });
      audioUrl = uploadResult.secureUrl;
    } catch (error: any) {
      logger.warn('Failed to upload attempt audio', { error: error.message });
      // Continue without audio URL - not critical
    }

    // 4. Evaluate pronunciation using Speechace
    let evaluationResult;
    try {
      let cleanAudioBase64 = params.audioBase64;
      if (cleanAudioBase64.includes(',')) {
        cleanAudioBase64 = cleanAudioBase64.split(',')[1];
      }

      evaluationResult = await speechaceService.scorePronunciation(
        pronunciation.text,
        cleanAudioBase64,
        params.learnerId
      );
    } catch (error: any) {
      logger.error('Speechace evaluation failed', { error: error.message });
      throw new ValidationError('Failed to evaluate pronunciation: ' + error.message);
    }

    // 5. Extract incorrect letters/phonemes
    const incorrectLetters: string[] = [];
    const incorrectPhonemes: string[] = [];

    if (evaluationResult.word_scores) {
      for (const wordScore of evaluationResult.word_scores) {
        if (wordScore.score < (params.passingThreshold || 70)) {
          for (const letter of wordScore.word) {
            if (!incorrectLetters.includes(letter.toLowerCase())) {
              incorrectLetters.push(letter.toLowerCase());
            }
          }
        }

        if (wordScore.phonemes) {
          for (const phoneme of wordScore.phonemes) {
            if (phoneme.score < (params.passingThreshold || 70)) {
              if (!incorrectPhonemes.includes(phoneme.phoneme)) {
                incorrectPhonemes.push(phoneme.phoneme);
              }
            }
          }
        }
      }
    }

    // 6. Determine if passed
    const passed = evaluationResult.text_score >= (params.passingThreshold || 70);

    // 7. Get next attempt number
    const attemptNumber = await this.attemptRepo.getNextAttemptNumber(assignment._id);

    // 8. Create attempt record
    const attempt = await this.attemptRepo.create({
      pronunciationAssignmentId: new Types.ObjectId(assignment._id.toString()),
      pronunciationId: new Types.ObjectId(params.pronunciationId),
      learnerId: new Types.ObjectId(params.learnerId),
      textScore: evaluationResult.text_score,
      fluencyScore: evaluationResult.fluency_score,
      passed,
      passingThreshold: params.passingThreshold || 70,
      wordScores: evaluationResult.word_scores || [],
      incorrectLetters,
      incorrectPhonemes,
      audioUrl,
      textFeedback: evaluationResult.text_feedback,
      wordFeedback: evaluationResult.word_feedback || [],
      attemptNumber,
    });

    // 9. Update assignment stats
    const bestScore = assignment.bestScore
      ? Math.max(assignment.bestScore, evaluationResult.text_score)
      : evaluationResult.text_score;

    await this.assignmentRepo.updateAttemptStats(assignment._id, {
      attemptsCount: assignment.attemptsCount + 1,
      bestScore,
      lastAttemptAt: new Date(),
    });

    // 10. Update assignment status
    if (passed) {
      await this.assignmentRepo.updateStatus(assignment._id, 'completed', new Date());
    } else {
      await this.assignmentRepo.updateStatus(assignment._id, 'in-progress');
    }

    // Get updated assignment
    const updatedAssignment = await this.assignmentRepo.findById(assignment._id);

    logger.info('Pronunciation attempt submitted', {
      pronunciationId: params.pronunciationId,
      userId: params.learnerId,
      score: evaluationResult.text_score,
      passed,
      attemptNumber,
    });

    return {
      attempt: {
        _id: attempt._id,
        textScore: evaluationResult.text_score,
        fluencyScore: evaluationResult.fluency_score,
        passed,
        wordScores: evaluationResult.word_scores,
        incorrectLetters,
        incorrectPhonemes,
        textFeedback: evaluationResult.text_feedback,
        wordFeedback: evaluationResult.word_feedback,
        attemptNumber,
      },
      assignment: updatedAssignment,
    };
  }

  /**
   * Create a pronunciation attempt from a drill (standalone, not linked to assignment)
   */
  async createDrillPronunciationAttempt(params: {
    learnerId: string;
    text: string;
    audioBase64: string;
    drillId?: string;
    drillAttemptId?: string;
    drillType?: string;
    passingThreshold?: number;
  }): Promise<any> {
    // 1. Upload audio recording
    let audioUrl: string | undefined;
    let audioDuration: number | undefined;
    try {
      let cleanAudioBase64 = params.audioBase64;
      if (cleanAudioBase64.includes(',')) {
        cleanAudioBase64 = cleanAudioBase64.split(',')[1];
      }

      const audioBuffer = Buffer.from(cleanAudioBase64, 'base64');
      const uploadResult = await uploadToCloudinary(audioBuffer, {
        folder: 'eklan/pronunciations/drill-attempts',
        publicId: `drill_attempt_${Date.now()}_${params.learnerId}`,
        resourceType: 'raw',
      });
      audioUrl = uploadResult.secureUrl;
      // Note: Duration calculation would require audio processing library
      // For now, we'll leave it undefined
    } catch (error: any) {
      logger.warn('Failed to upload drill attempt audio', { error: error.message });
      // Continue without audio URL - not critical
    }

    // 2. Evaluate pronunciation using Speechace
    let evaluationResult;
    try {
      let cleanAudioBase64 = params.audioBase64;
      if (cleanAudioBase64.includes(',')) {
        cleanAudioBase64 = cleanAudioBase64.split(',')[1];
      }

      evaluationResult = await speechaceService.scorePronunciation(
        params.text,
        cleanAudioBase64,
        params.learnerId
      );
    } catch (error: any) {
      logger.error('Speechace evaluation failed for drill attempt', { error: error.message });
      throw new ValidationError('Failed to evaluate pronunciation: ' + error.message);
    }

    // 3. Extract incorrect letters/phonemes
    const incorrectLetters: string[] = [];
    const incorrectPhonemes: string[] = [];

    if (evaluationResult.word_scores) {
      for (const wordScore of evaluationResult.word_scores) {
        if (wordScore.score < (params.passingThreshold || 70)) {
          for (const letter of wordScore.word) {
            if (!incorrectLetters.includes(letter.toLowerCase())) {
              incorrectLetters.push(letter.toLowerCase());
            }
          }
        }

        if (wordScore.phonemes) {
          for (const phoneme of wordScore.phonemes) {
            if (phoneme.score < (params.passingThreshold || 70)) {
              if (!incorrectPhonemes.includes(phoneme.phoneme)) {
                incorrectPhonemes.push(phoneme.phoneme);
              }
            }
          }
        }
      }
    }

    // 4. Determine if passed
    const passed = evaluationResult.text_score >= (params.passingThreshold || 70);

    // 5. Create attempt record (without assignment)
    const attemptData: any = {
      learnerId: new Types.ObjectId(params.learnerId),
      textScore: evaluationResult.text_score,
      fluencyScore: evaluationResult.fluency_score,
      passed,
      passingThreshold: params.passingThreshold || 70,
      wordScores: evaluationResult.word_scores || [],
      incorrectLetters,
      incorrectPhonemes,
      audioUrl,
      audioDuration,
      textFeedback: evaluationResult.text_feedback,
      wordFeedback: evaluationResult.word_feedback || [],
      attemptNumber: 1, // Standalone attempts start at 1
    };

    // Add drill-related fields if provided
    if (params.drillId) {
      attemptData.drillId = new Types.ObjectId(params.drillId);
    }
    if (params.drillAttemptId) {
      attemptData.drillAttemptId = new Types.ObjectId(params.drillAttemptId);
    }
    if (params.drillType) {
      attemptData.drillType = params.drillType;
    }

    const attempt = await this.attemptRepo.create(attemptData);

    logger.info('Drill pronunciation attempt created', {
      attemptId: attempt._id,
      userId: params.learnerId,
      drillId: params.drillId,
      score: evaluationResult.text_score,
      passed,
    });

    return {
      _id: attempt._id,
      textScore: evaluationResult.text_score,
      fluencyScore: evaluationResult.fluency_score,
      passed,
      wordScores: evaluationResult.word_scores,
      incorrectLetters,
      incorrectPhonemes,
      textFeedback: evaluationResult.text_feedback,
      wordFeedback: evaluationResult.word_feedback,
      audioUrl,
    };
  }
}

