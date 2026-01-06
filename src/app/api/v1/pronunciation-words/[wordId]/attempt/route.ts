// POST /api/v1/pronunciation-words/[wordId]/attempt
// Submit a pronunciation attempt for a word
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationWord from '@/models/pronunciation-word';
import PronunciationProblem from '@/models/pronunciation-problem';
import LearnerPronunciationProgress from '@/models/learner-pronunciation-progress';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import Learner from '@/models/leaner';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { speechaceService } from '@/lib/api/speechace.service';
import { uploadToCloudinary } from '@/services/cloudinary.service';

const attemptSchema = z.object({
	audioBase64: z.string().min(1, 'Audio recording is required'),
	passingThreshold: z.number().min(0).max(100).optional().default(70),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { wordId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { wordId } = params;
		const body = await req.json();
		const validated = attemptSchema.parse(body);

		// Find learner profile
		const learner = await Learner.findOne({ userId: context.userId }).lean().exec();
		if (!learner) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Learner profile not found',
				},
				{ status: 404 }
			);
		}

		// Find word and problem
		const word = await PronunciationWord.findById(wordId).lean().exec();
		if (!word) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation word not found',
				},
				{ status: 404 }
			);
		}

		const problem = await PronunciationProblem.findById(word.problemId).lean().exec();
		if (!problem) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation problem not found',
				},
				{ status: 404 }
			);
		}

		// Find or create progress record
		let progress = await LearnerPronunciationProgress.findOne({
			learnerId: learner._id,
			wordId: word._id,
		});

		if (!progress) {
			progress = await LearnerPronunciationProgress.create({
				learnerId: learner._id,
				problemId: problem._id,
				wordId: word._id,
				attempts: 0,
				accuracyScores: [],
				passed: false,
			});
		}

		// Upload audio recording to Cloudinary
		let audioUrl: string | undefined;
		try {
			let cleanAudioBase64 = validated.audioBase64;
			if (cleanAudioBase64.includes(',')) {
				cleanAudioBase64 = cleanAudioBase64.split(',')[1];
			}

			const audioBuffer = Buffer.from(cleanAudioBase64, 'base64');
			const uploadResult = await uploadToCloudinary(audioBuffer, {
				folder: 'eklan/pronunciations/attempts',
				publicId: `attempt_${Date.now()}_${learner._id}`,
				resourceType: 'raw',
			});
			audioUrl = uploadResult.secureUrl;
		} catch (error: any) {
			logger.warn('Failed to upload attempt audio', { error: error.message });
		}

		// Evaluate pronunciation using Speechace
		let evaluationResult;
		try {
			let cleanAudioBase64 = validated.audioBase64;
			if (cleanAudioBase64.includes(',')) {
				cleanAudioBase64 = cleanAudioBase64.split(',')[1];
			}

			evaluationResult = await speechaceService.scorePronunciation(
				word.word,
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

		// Extract incorrect letters/phonemes
		const incorrectLetters: string[] = [];
		const incorrectPhonemes: string[] = [];

		if (evaluationResult.word_scores) {
			for (const wordScore of evaluationResult.word_scores) {
				if (wordScore.score < validated.passingThreshold) {
					for (const letter of wordScore.word) {
						if (!incorrectLetters.includes(letter.toLowerCase())) {
							incorrectLetters.push(letter.toLowerCase());
						}
					}
				}

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

		// Update progress
		progress.attempts += 1;
		progress.accuracyScores.push(evaluationResult.text_score);
		progress.lastAttemptAt = new Date();

		// Update best score
		if (!progress.bestScore || evaluationResult.text_score > progress.bestScore) {
			progress.bestScore = evaluationResult.text_score;
		}

		// Update weak phonemes (accumulate from all attempts)
		const allWeakPhonemes = new Set([...progress.weakPhonemes, ...incorrectPhonemes]);
		progress.weakPhonemes = Array.from(allWeakPhonemes);

		// Update incorrect letters
		const allIncorrectLetters = new Set([...progress.incorrectLetters, ...incorrectLetters]);
		progress.incorrectLetters = Array.from(allIncorrectLetters);

		// Update passed status
		if (passed && !progress.passed) {
			progress.passed = true;
			progress.passedAt = new Date();
		}

		await progress.save();

		// Create attempt record
		const attemptNumber = progress.attempts;
		const attempt = await PronunciationAttempt.create({
			problemId: problem._id,
			wordId: word._id,
			progressId: progress._id,
			learnerId: learner._id,
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
			attemptNumber: attemptNumber,
		});

		logger.info('Pronunciation attempt submitted', {
			wordId: word._id,
			learnerId: learner._id,
			score: evaluationResult.text_score,
			passed: passed,
			attemptNumber: attemptNumber,
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
						attemptNumber: attemptNumber,
					},
					progress: {
						passed: progress.passed,
						attempts: progress.attempts,
						bestScore: progress.bestScore,
						averageScore: progress.averageScore,
						isChallenging: progress.isChallenging,
						challengeLevel: progress.challengeLevel,
						weakPhonemes: progress.weakPhonemes,
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
			wordId: params.wordId,
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
	{ params }: { params: Promise<{ wordId: string }> }
) {
	const resolvedParams = await params;
	return withRole(['user'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

