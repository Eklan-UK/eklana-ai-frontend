// GET /api/v1/daily-focus/[id] - Get single daily focus
// PUT /api/v1/daily-focus/[id] - Update daily focus
// DELETE /api/v1/daily-focus/[id] - Delete daily focus
import { NextRequest, NextResponse } from 'next/server';
import { withRole, withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DailyFocus from '@/models/daily-focus';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

// Validation schemas
const fillInBlankQuestionSchema = z.object({
	sentence: z.string().min(1),
	correctAnswer: z.string().min(1),
	options: z.array(z.string()).optional(),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const matchingQuestionSchema = z.object({
	left: z.string().min(1),
	right: z.string().min(1),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const multipleChoiceQuestionSchema = z.object({
	question: z.string().min(1),
	options: z.array(z.string()).min(2),
	correctIndex: z.number().int().min(0),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const vocabularyQuestionSchema = z.object({
	word: z.string().min(1),
	definition: z.string().min(1),
	exampleSentence: z.string().optional(),
	pronunciation: z.string().optional(),
	hint: z.string().optional(),
	explanation: z.string().optional(),
});

const updateDailyFocusSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	focusType: z.enum(['grammar', 'vocabulary', 'matching', 'pronunciation', 'general']).optional(),
	practiceFormat: z.enum(['fill-in-blank', 'matching', 'multiple-choice', 'vocabulary', 'mixed']).optional(),
	description: z.string().max(500).optional(),
	date: z.string().datetime().optional(),
	estimatedMinutes: z.number().int().min(1).max(60).optional(),
	difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
	showExplanationsAfterSubmission: z.boolean().optional(),
	fillInBlankQuestions: z.array(fillInBlankQuestionSchema).optional(),
	matchingQuestions: z.array(matchingQuestionSchema).optional(),
	multipleChoiceQuestions: z.array(multipleChoiceQuestionSchema).optional(),
	vocabularyQuestions: z.array(vocabularyQuestionSchema).optional(),
	isActive: z.boolean().optional(),
});

// GET handler - Get single daily focus by ID
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { id: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { id } = params;

		if (!Types.ObjectId.isValid(id)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid daily focus ID',
				},
				{ status: 400 }
			);
		}

		const dailyFocus = await DailyFocus.findById(id)
			.populate('createdBy', 'firstName lastName email')
			.lean()
			.exec();

		if (!dailyFocus) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Daily focus not found',
				},
				{ status: 404 }
			);
		}

		// Calculate total questions
		const totalQuestions = 
			(dailyFocus.fillInBlankQuestions?.length || 0) +
			(dailyFocus.matchingQuestions?.length || 0) +
			(dailyFocus.multipleChoiceQuestions?.length || 0) +
			(dailyFocus.vocabularyQuestions?.length || 0);

		return NextResponse.json(
			{
				code: 'Success',
				dailyFocus: {
					...dailyFocus,
					totalQuestions,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching daily focus', error);
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

// PUT handler - Update daily focus
async function putHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { id: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { id } = params;

		if (!Types.ObjectId.isValid(id)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid daily focus ID',
				},
				{ status: 400 }
			);
		}

		const body = await req.json();
		const validated = updateDailyFocusSchema.parse(body);

		// Check if daily focus exists
		const existingFocus = await DailyFocus.findById(id).exec();
		if (!existingFocus) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Daily focus not found',
				},
				{ status: 404 }
			);
		}

		// Build update object
		const updateData: any = { ...validated };
		if (validated.date) {
			updateData.date = new Date(validated.date);
		}

		const updatedFocus = await DailyFocus.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true, runValidators: true }
		)
			.populate('createdBy', 'firstName lastName email')
			.lean()
			.exec();

		logger.info('Daily focus updated successfully', {
			dailyFocusId: id,
			updatedBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Daily focus updated successfully',
				dailyFocus: updatedFocus,
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
		logger.error('Error updating daily focus', error);
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

// DELETE handler - Delete daily focus
async function deleteHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { id: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { id } = params;

		if (!Types.ObjectId.isValid(id)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid daily focus ID',
				},
				{ status: 400 }
			);
		}

		const deletedFocus = await DailyFocus.findByIdAndDelete(id).exec();

		if (!deletedFocus) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Daily focus not found',
				},
				{ status: 404 }
			);
		}

		logger.info('Daily focus deleted successfully', {
			dailyFocusId: id,
			deletedBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Daily focus deleted successfully',
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error deleting daily focus', error);
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

// Export handlers with appropriate access control
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const resolvedParams = await params;
	// Users can view individual focus items (for practice)
	return withAuth((req, context) =>
		getHandler(req, context, resolvedParams)
	)(req);
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const resolvedParams = await params;
	// Admin only for updates
	return withRole(['admin'], (req, context) =>
		putHandler(req, context, resolvedParams)
	)(req);
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const resolvedParams = await params;
	// Admin only for deletion
	return withRole(['admin'], (req, context) =>
		deleteHandler(req, context, resolvedParams)
	)(req);
}

