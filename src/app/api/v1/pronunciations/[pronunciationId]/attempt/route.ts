// POST /api/v1/pronunciations/[pronunciationId]/attempt
// Submit a pronunciation attempt
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAssignment from '@/models/pronunciation-assignment';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import Pronunciation from '@/models/pronunciation';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { speechaceService } from '@/lib/api/speechace.service';
import { uploadToCloudinary } from '@/services/cloudinary.service';

const attemptSchema = z.object({
	assignmentId: z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Assignment ID must be a valid MongoDB ObjectId',
	}).optional(),
	audioBase64: z.string().min(1, 'Audio recording is required'),
	passingThreshold: z.number().min(0).max(100).optional().default(70),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { pronunciationId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { pronunciationId } = params;
		const body = await req.json();
		const validated = attemptSchema.parse(body);

		// Use userId directly (learnerId now references User)

		// Find pronunciation
		const pronunciation = await Pronunciation.findById(pronunciationId).lean().exec();
		if (!pronunciation) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation not found',
				},
				{ status: 404 }
			);
		}

		// Find or create assignment
		let assignment = await PronunciationAssignment.findOne({
			pronunciationId,
			learnerId: context.userId,
		});

		if (!assignment) {
			// Create assignment if it doesn't exist
			assignment = await PronunciationAssignment.create({
				pronunciationId,
				learnerId: context.userId, // learnerId now references User
				assignedBy: context.userId, // Self-assigned in this case
				status: 'in-progress',
			});
		}

		// Upload audio recording to Cloudinary
		let audioUrl: string | undefined;
		try {
			// Remove data URL prefix if present
			let cleanAudioBase64 = validated.audioBase64;
			if (cleanAudioBase64.includes(',')) {
				cleanAudioBase64 = cleanAudioBase64.split(',')[1];
			}

			const audioBuffer = Buffer.from(cleanAudioBase64, 'base64');
			const uploadResult = await uploadToCloudinary(audioBuffer, {
				folder: 'eklan/pronunciations/attempts',
				publicId: `attempt_${Date.now()}_${context.userId}`,
				resourceType: 'raw',
			});
			audioUrl = uploadResult.secureUrl;
		} catch (error: any) {
			logger.warn('Failed to upload attempt audio', { error: error.message });
			// Continue without audio URL - not critical
		}

		// Evaluate pronunciation using Speechace
		let evaluationResult;
		try {
			// Clean audio base64
			let cleanAudioBase64 = validated.audioBase64;
			if (cleanAudioBase64.includes(',')) {
				cleanAudioBase64 = cleanAudioBase64.split(',')[1];
			}

			evaluationResult = await speechaceService.scorePronunciation(
				pronunciation.text,
				cleanAudioBase64,
				context.userId.toString()
			);
		} catch (error: any) {
			logger.error('Speechace evaluation failed', { error: error.message });
			return NextResponse.json(
				{
					code: 'ServerError',
					message: 'Failed to evaluate pronunciation: ' + error.message,
				},
				{ status: 500 }
			);
		}

		// Extract incorrect letters/phonemes from word scores
		const incorrectLetters: string[] = [];
		const incorrectPhonemes: string[] = [];

		if (evaluationResult.word_scores) {
			for (const wordScore of evaluationResult.word_scores) {
				// If word score is below threshold, mark letters as incorrect
				if (wordScore.score < validated.passingThreshold) {
					// Add individual letters that might be problematic
					for (const letter of wordScore.word) {
						if (!incorrectLetters.includes(letter.toLowerCase())) {
							incorrectLetters.push(letter.toLowerCase());
						}
					}
				}

				// Extract incorrect phonemes
				if (wordScore.phonemes) {
					for (const phoneme of wordScore.phonemes) {
						if (phoneme.score < validated.passingThreshold) {
							if (!incorrectPhonemes.includes(phoneme.phoneme)) {
								incorrectPhonemes.push(phoneme.phoneme);
							}
						}
					}
				}
			}
		}

		// Determine if pronunciation passed
		const passed = evaluationResult.text_score >= validated.passingThreshold;

		// Get next attempt number
		const attemptCount = await PronunciationAttempt.countDocuments({
			pronunciationAssignmentId: assignment._id,
		});

		// Create attempt record (learnerId now references User)
		const attempt = await PronunciationAttempt.create({
			pronunciationAssignmentId: assignment._id,
			pronunciationId,
			learnerId: context.userId,
			textScore: evaluationResult.text_score,
			fluencyScore: evaluationResult.fluency_score,
			passed: passed,
			passingThreshold: validated.passingThreshold,
			wordScores: evaluationResult.word_scores || [],
			incorrectLetters: incorrectLetters,
			incorrectPhonemes: incorrectPhonemes,
			audioUrl: audioUrl,
			textFeedback: evaluationResult.text_feedback,
			wordFeedback: evaluationResult.word_feedback || [],
			attemptNumber: attemptCount + 1,
		});

		// Update assignment
		assignment.attemptsCount = attemptCount + 1;
		assignment.lastAttemptAt = new Date();

		// Update best score if this is better
		if (!assignment.bestScore || evaluationResult.text_score > assignment.bestScore) {
			assignment.bestScore = evaluationResult.text_score;
		}

		// Update status based on pass/fail
		if (passed) {
			assignment.status = 'completed';
			assignment.completedAt = new Date();
		} else {
			assignment.status = 'in-progress';
		}

		await assignment.save();

		logger.info('Pronunciation attempt submitted', {
			pronunciationId,
			userId: context.userId,
			score: evaluationResult.text_score,
			passed: passed,
			attemptNumber: attemptCount + 1,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation attempt submitted successfully',
				data: {
					attempt: {
						_id: attempt._id,
						textScore: evaluationResult.text_score,
						fluencyScore: evaluationResult.fluency_score,
						passed: passed,
						wordScores: evaluationResult.word_scores,
						incorrectLetters: incorrectLetters,
						incorrectPhonemes: incorrectPhonemes,
						textFeedback: evaluationResult.text_feedback,
						wordFeedback: evaluationResult.word_feedback,
						attemptNumber: attemptCount + 1,
					},
					assignment: {
						status: assignment.status,
						attemptsCount: assignment.attemptsCount,
						bestScore: assignment.bestScore,
						completedAt: assignment.completedAt,
					},
				},
			},
			{ status: 201 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Validation failed',
					errors: error.issues,
				},
				{ status: 400 }
			);
		}

		logger.error('Error submitting pronunciation attempt', {
			error: error.message,
			stack: error.stack,
			pronunciationId: params.pronunciationId,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to submit pronunciation attempt',
			},
			{ status: 500 }
		);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ pronunciationId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['user'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

