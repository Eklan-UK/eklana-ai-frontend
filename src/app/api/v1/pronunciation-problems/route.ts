// GET /api/v1/pronunciation-problems - Get all pronunciation problems (global, visible to all)
// POST /api/v1/pronunciation-problems - Create a new pronunciation problem (admin)
import { NextRequest, NextResponse } from 'next/server';
import { withRole, withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationProblem from '@/models/pronunciation-problem';
import PronunciationWord from '@/models/pronunciation-word';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

// GET handler - Get all active problems (public for learners, all for admin)
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const difficulty = searchParams.get('difficulty');
		const isActive = searchParams.get('isActive');

		// Build query
		const query: any = {};

		// Learners can only see active problems, admins can see all
		if (context.userRole !== 'admin') {
			query.isActive = true;
		} else if (isActive !== undefined) {
			query.isActive = isActive === 'true';
		}

		if (difficulty) {
			query.difficulty = difficulty;
		}

		// Get problems with word counts
		const problems = await PronunciationProblem.find(query)
			.populate('createdBy', 'email firstName lastName')
			.sort({ order: 1, createdAt: -1 })
			.lean()
			.exec();

		// Get word counts for each problem
		const problemsWithWordCounts = await Promise.all(
			problems.map(async (problem) => {
				const wordCount = await PronunciationWord.countDocuments({
					problemId: problem._id,
					isActive: true,
				});
				return {
					...problem,
					wordCount,
				};
			})
		);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation problems retrieved successfully',
				data: {
					problems: problemsWithWordCounts,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching pronunciation problems', {
			error: error.message,
			stack: error.stack,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch pronunciation problems',
			},
			{ status: 500 }
		);
	}
}

// POST handler - Create pronunciation problem (admin only)
async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const { title, description, phonemes, difficulty, estimatedTimeMinutes, order } = body;

		// Validate required fields
		if (!title || !phonemes || !Array.isArray(phonemes) || phonemes.length === 0) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Title and at least one phoneme are required',
				},
				{ status: 400 }
			);
		}

		// Only admins can create problems
		if (context.userRole !== 'admin') {
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'Only admins can create pronunciation problems',
				},
				{ status: 403 }
			);
		}

		// Generate slug from title
		const slug = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

		// Check if slug already exists
		const existing = await PronunciationProblem.findOne({ slug });
		if (existing) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'A problem with this title already exists',
				},
				{ status: 400 }
			);
		}

		// Create problem
		const problem = await PronunciationProblem.create({
			title,
			slug,
			description: description || undefined,
			phonemes,
			difficulty: difficulty || 'intermediate',
			estimatedTimeMinutes: estimatedTimeMinutes || undefined,
			order: order || 0,
			createdBy: context.userId,
			isActive: true,
		});

		await problem.populate('createdBy', 'email firstName lastName');

		logger.info('Pronunciation problem created successfully', {
			problemId: problem._id,
			createdBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation problem created successfully',
				data: {
					problem,
				},
			},
			{ status: 201 }
		);
	} catch (error: any) {
		logger.error('Error creating pronunciation problem', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to create pronunciation problem',
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(getHandler);
export const POST = withRole(['admin'], postHandler);

