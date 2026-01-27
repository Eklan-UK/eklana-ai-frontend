// GET /api/v1/daily-focus/today - Fetch today's daily focus (user accessible)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DailyFocus from '@/models/daily-focus';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

// GET handler - Get today's daily focus
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		// Get today's date range in UTC (start of day to end of day)
		const now = new Date();
		const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
		const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

		logger.info('Searching for daily focus', {
			now: now.toISOString(),
			todayStart: todayStart.toISOString(),
			todayEnd: todayEnd.toISOString(),
		});

		// Find today's active daily focus
		let dailyFocus = await DailyFocus.findOne({
			date: { $gte: todayStart, $lte: todayEnd },
			isActive: true,
		})
			.populate('createdBy', 'firstName lastName')
			.lean()
			.exec();
		const my_focus = await DailyFocus.find();
			
			console.log('dailyFocus', my_focus);

		// If not found, also check using date string matching (handles timezone edge cases)
		if (!dailyFocus) {
			const todayString = now.toISOString().split('T')[0]; // e.g., "2024-01-21"
			
			// Get all active daily focus and filter by date string
			const allActiveFocus = await DailyFocus.find({ isActive: true })
				.populate('createdBy', 'firstName lastName')
				.lean()
				.exec();
			
			dailyFocus = allActiveFocus.find((df: any) => {
				const dfDate = new Date(df.date).toISOString().split('T')[0];
				return dfDate === todayString;
			}) || null;
			
			if (dailyFocus) {
				logger.info('Found daily focus via string matching', { 
					dailyFocusId: dailyFocus._id,
					date: dailyFocus.date 
				});
			}
		}

		if (!dailyFocus) {
			logger.info('No daily focus found for today');
			return NextResponse.json(
				{
					code: 'NotFound',
					message: 'No daily focus available for today',
					dailyFocus: null,
				},
				{ status: 200 } // Return 200 with null, not 404
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
		logger.error('Error fetching today\'s daily focus', error);
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

// Any authenticated user can access today's focus
export const GET = withAuth(getHandler);

