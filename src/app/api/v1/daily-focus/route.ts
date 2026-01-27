// GET /api/v1/daily-focus - List all daily focus entries (admin only)
// POST /api/v1/daily-focus - Create a new daily focus entry (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DailyFocus from '@/models/daily-focus';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';
import { onDailyFocusAvailable } from '@/services/notification/triggers';

// Validation schemas
const fillInBlankQuestionSchema = z.object({
	sentence: z.string().min(1),
	sentenceAudioUrl: z.string().optional(),
	correctAnswer: z.string().min(1),
	options: z.array(z.string()).optional(),
	optionsAudioUrls: z.array(z.string()).optional(),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const matchingQuestionSchema = z.object({
	left: z.string().min(1),
	leftAudioUrl: z.string().optional(),
	right: z.string().min(1),
	rightAudioUrl: z.string().optional(),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const multipleChoiceQuestionSchema = z.object({
	question: z.string().min(1),
	questionAudioUrl: z.string().optional(),
	options: z.array(z.string()).min(2),
	optionsAudioUrls: z.array(z.string()).optional(),
	correctIndex: z.number().int().min(0),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const vocabularyQuestionSchema = z.object({
	word: z.string().min(1),
	wordAudioUrl: z.string().optional(),
	definition: z.string().min(1),
	definitionAudioUrl: z.string().optional(),
	exampleSentence: z.string().optional(),
	exampleAudioUrl: z.string().optional(),
	pronunciation: z.string().optional(),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const createDailyFocusSchema = z.object({
	title: z.string().min(1).max(200),
	focusType: z.enum(['grammar', 'vocabulary', 'matching', 'pronunciation', 'general']),
	practiceFormat: z.enum(['fill-in-blank', 'matching', 'multiple-choice', 'vocabulary', 'mixed']),
	description: z.string().max(500).optional(),
	date: z.string().datetime(),
	estimatedMinutes: z.number().int().min(1).max(60).optional(),
	difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
	showExplanationsAfterSubmission: z.boolean().optional(),
	fillInBlankQuestions: z.array(fillInBlankQuestionSchema).optional(),
	matchingQuestions: z.array(matchingQuestionSchema).optional(),
	multipleChoiceQuestions: z.array(multipleChoiceQuestionSchema).optional(),
	vocabularyQuestions: z.array(vocabularyQuestionSchema).optional(),
	isActive: z.boolean().optional(),
});

// GET handler - List all daily focus entries
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '20');
		const offset = parseInt(searchParams.get('offset') || '0');
		const focusType = searchParams.get('focusType');
		const practiceFormat = searchParams.get('practiceFormat');
		const isActive = searchParams.get('isActive');
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');

		const query: any = {};

		if (focusType) query.focusType = focusType;
		if (practiceFormat) query.practiceFormat = practiceFormat;
		if (isActive !== null && isActive !== undefined) {
			query.isActive = isActive === 'true';
		}
		
		// Date range filter
		if (startDate || endDate) {
			query.date = {};
			if (startDate) query.date.$gte = new Date(startDate);
			if (endDate) query.date.$lte = new Date(endDate);
		}

		const dailyFocusEntries = await DailyFocus.find(query)
			.select('title focusType practiceFormat description date estimatedMinutes difficulty isActive totalCompletions averageScore createdAt')
			.populate('createdBy', 'firstName lastName email')
			.limit(limit)
			.skip(offset)
			.sort({ date: -1 })
			.lean()
			.exec();

		const total = await DailyFocus.countDocuments(query);

		return NextResponse.json(
			{
				dailyFocus: dailyFocusEntries,
				total,
				limit,
				offset,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching daily focus entries', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Internal Server Error',
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

// POST handler - Create a new daily focus entry
async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const validated = createDailyFocusSchema.parse(body);

		// Validate that at least one question type has items
		const hasQuestions = 
			(validated.fillInBlankQuestions && validated.fillInBlankQuestions.length > 0) ||
			(validated.matchingQuestions && validated.matchingQuestions.length > 0) ||
			(validated.multipleChoiceQuestions && validated.multipleChoiceQuestions.length > 0) ||
			(validated.vocabularyQuestions && validated.vocabularyQuestions.length > 0);

		if (!hasQuestions) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'At least one question must be provided',
				},
				{ status: 400 }
			);
		}

		// Create daily focus entry
		const dailyFocusData: any = {
			title: validated.title,
			focusType: validated.focusType,
			practiceFormat: validated.practiceFormat,
			description: validated.description || '',
			date: new Date(validated.date),
			estimatedMinutes: validated.estimatedMinutes || 5,
			difficulty: validated.difficulty || 'intermediate',
			showExplanationsAfterSubmission: validated.showExplanationsAfterSubmission !== false,
			createdBy: context.userId,
			isActive: validated.isActive !== false,
			totalCompletions: 0,
			averageScore: 0,
		};

		// Add questions
		if (validated.fillInBlankQuestions) {
			dailyFocusData.fillInBlankQuestions = validated.fillInBlankQuestions;
		}
		if (validated.matchingQuestions) {
			dailyFocusData.matchingQuestions = validated.matchingQuestions;
		}
		if (validated.multipleChoiceQuestions) {
			dailyFocusData.multipleChoiceQuestions = validated.multipleChoiceQuestions;
		}
		if (validated.vocabularyQuestions) {
			dailyFocusData.vocabularyQuestions = validated.vocabularyQuestions;
		}

		const dailyFocus = await DailyFocus.create(dailyFocusData);

		logger.info('Daily focus created successfully', {
			dailyFocusId: dailyFocus._id,
			createdBy: context.userId,
		});

		// Check if this is for today - if so, send notifications to all users
		const focusDate = new Date(validated.date);
		const today = new Date();
		const isForToday = 
			focusDate.getUTCFullYear() === today.getUTCFullYear() &&
			focusDate.getUTCMonth() === today.getUTCMonth() &&
			focusDate.getUTCDate() === today.getUTCDate();

		if (isForToday && dailyFocus.isActive) {
			// Send notifications asynchronously (don't block response)
			(async () => {
				try {
					// Get all users with role 'user'
					const users = await User.find({ role: 'user' })
						.select('_id')
						.lean()
						.exec();

					const userIds = users.map(u => u._id.toString());
					
					if (userIds.length > 0) {
						logger.info('Sending daily focus notifications', {
							dailyFocusId: dailyFocus._id,
							userCount: userIds.length,
						});

						await onDailyFocusAvailable(userIds, {
							_id: dailyFocus._id.toString(),
							title: dailyFocus.title,
						});
					}
				} catch (err: any) {
					logger.error('Failed to send daily focus notifications', { error: err.message });
				}
			})();
		}

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Daily focus created successfully',
				dailyFocus,
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
		logger.error('Error creating daily focus', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Internal Server Error',
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

// Admin only for listing and creating
export const GET = withRole(['admin'], getHandler);
export const POST = withRole(['admin'], postHandler);

