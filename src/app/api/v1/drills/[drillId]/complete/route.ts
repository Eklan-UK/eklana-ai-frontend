// POST /api/v1/drills/[drillId]/complete
// Complete a drill and create an attempt record
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';
import DrillAttempt from '@/models/drill-attempt';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const completeSchema = z.object({
	drillAssignmentId: z.string().refine((id) => Types.ObjectId.isValid(id), {
		message: 'Drill assignment ID must be a valid MongoDB ObjectId',
	}),
	score: z.number().min(0).max(100),
	timeSpent: z.number().min(0),
	vocabularyResults: z.object({
		wordScores: z.array(z.object({
			word: z.string(),
			score: z.number(),
			attempts: z.number(),
			pronunciationScore: z.number().optional(),
		})),
	}).optional(),
	roleplayResults: z.object({
		sceneScores: z.array(z.object({
			sceneName: z.string(),
			score: z.number(),
			fluencyScore: z.number().optional(),
			pronunciationScore: z.number().optional(),
		})),
	}).optional(),
	matchingResults: z.object({
		pairsMatched: z.number(),
		totalPairs: z.number(),
		accuracy: z.number(),
		incorrectPairs: z.array(z.object({
			left: z.string(),
			right: z.string(),
			attemptedMatch: z.string(),
		})).optional(),
	}).optional(),
	definitionResults: z.object({
		wordsDefined: z.number(),
		totalWords: z.number(),
		accuracy: z.number(),
		wordScores: z.array(z.object({
			word: z.string(),
			score: z.number(),
			attempts: z.number(),
		})),
	}).optional(),
	grammarResults: z.object({
		patternsPracticed: z.number(),
		totalPatterns: z.number(),
		accuracy: z.number(),
		patternScores: z.array(z.object({
			pattern: z.string(),
			score: z.number(),
			attempts: z.number(),
		})),
	}).optional(),
	sentenceWritingResults: z.object({
		sentencesWritten: z.number(),
		totalSentences: z.number(),
		accuracy: z.number(),
		wordScores: z.array(z.object({
			word: z.string(),
			score: z.number(),
			attempts: z.number(),
		})),
	}).optional(),
	sentenceResults: z.object({
		word: z.string(),
		definition: z.string(),
		sentences: z.array(z.object({
			text: z.string(),
			index: z.number(),
		})),
		reviewStatus: z.enum(['pending', 'reviewed']).default('pending'),
	}).optional(),
	summaryResults: z.object({
		summaryProvided: z.boolean(),
		score: z.number().optional(),
		wordCount: z.number().optional(),
		qualityScore: z.number().optional(),
	}).optional(),
	listeningResults: z.object({
		completed: z.boolean(),
		timeSpent: z.number(),
	}).optional(),
	deviceInfo: z.string().optional(),
	platform: z.enum(['web', 'ios', 'android']).optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { drillId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { drillId } = params;
		const body = await req.json();
		const validated = completeSchema.parse(body);

		// Validate drill ID
		if (!Types.ObjectId.isValid(drillId)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid drill ID format',
				},
				{ status: 400 }
			);
		}

		// Verify drill exists
		const drill = await Drill.findById(drillId).lean().exec();
		if (!drill) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Drill not found',
				},
				{ status: 404 }
			);
		}

		// Verify assignment exists and belongs to user
		const assignment = await DrillAssignment.findById(validated.drillAssignmentId).lean().exec();
		if (!assignment) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Drill assignment not found',
				},
				{ status: 404 }
			);
		}

		// Verify assignment belongs to the user (learnerId now references User directly)
		if (assignment.learnerId.toString() !== context.userId.toString()) {
			return NextResponse.json(
				{
					code: 'Forbidden',
					message: 'You do not have permission to complete this drill assignment',
				},
				{ status: 403 }
			);
		}

		// Verify assignment is for the correct drill
		if (assignment.drillId.toString() !== drillId) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Drill assignment does not match drill ID',
				},
				{ status: 400 }
			);
		}

		// Create drill attempt
		const attempt = await DrillAttempt.create({
			drillAssignmentId: new Types.ObjectId(validated.drillAssignmentId),
			learnerId: context.userId, // learnerId now references User (kept for backward compatibility)
			drillId: new Types.ObjectId(drillId),
			startedAt: new Date(Date.now() - validated.timeSpent * 1000), // Approximate start time
			completedAt: new Date(),
			timeSpent: validated.timeSpent,
			score: validated.score,
			maxScore: 100,
			vocabularyResults: validated.vocabularyResults,
			roleplayResults: validated.roleplayResults,
			matchingResults: validated.matchingResults,
			definitionResults: validated.definitionResults,
			grammarResults: validated.grammarResults,
			sentenceWritingResults: validated.sentenceWritingResults,
			sentenceResults: validated.sentenceResults,
			summaryResults: validated.summaryResults,
			listeningResults: validated.listeningResults,
			deviceInfo: validated.deviceInfo,
			platform: validated.platform || 'web',
		});

		// Update assignment status
		await DrillAssignment.findByIdAndUpdate(
			validated.drillAssignmentId,
			{
				status: 'completed',
				completedAt: new Date(),
				score: validated.score,
			},
			{ new: true }
		);

		logger.info('Drill completed successfully', {
			drillId,
			assignmentId: validated.drillAssignmentId,
			userId: context.userId,
			score: validated.score,
			attemptId: attempt._id,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Drill completed successfully',
				data: {
					attempt: {
						id: attempt._id.toString(),
						score: attempt.score,
						timeSpent: attempt.timeSpent,
						completedAt: attempt.completedAt?.toISOString(),
					},
				},
			},
			{ status: 200 }
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

		logger.error('Error completing drill', {
			error: error.message,
			stack: error.stack,
			drillId: params.drillId,
			userId: context.userId,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to complete drill',
			},
			{ status: 500 }
		);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ drillId: string }> }
) {
	const resolvedParams = await params;
	return withAuth((req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

