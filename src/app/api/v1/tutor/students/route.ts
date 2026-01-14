// GET /api/v1/tutor/students
// Get all students assigned to the authenticated tutor with drill counts
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import Profile from '@/models/profile';
import DrillAssignment from '@/models/drill-assignment';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || String(config.defaultResLimit));
		const offset = parseInt(searchParams.get('offset') || String(config.defaultResOffset));

		// Optimize: Use aggregation to get users and count in a single query
		// First get total count efficiently
		const total = await Profile.countDocuments({ tutorId: context.userId }).exec();

		// Get user IDs with pagination
		const profiles = await Profile.find({ tutorId: context.userId })
			.select('userId')
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		const userIds = profiles.map((p) => p.userId);

		// Find all users assigned to this tutor
		const users = await User.find({ _id: { $in: userIds } })
			.select('-password -__v')
			.sort({ createdAt: -1 })
			.lean()
			.exec();

		// Get drill assignment counts per student in a single aggregation
		const drillCounts = await DrillAssignment.aggregate([
			{
				$match: {
					learnerId: { $in: userIds.map(id => new Types.ObjectId(id)) },
					assignedBy: context.userId,
				},
			},
			{
				$group: {
					_id: '$learnerId',
					totalAssigned: { $sum: 1 },
					completed: {
						$sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
					},
					pending: {
						$sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
					},
					inProgress: {
						$sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
					},
				},
			},
		]).exec();

		// Create a map of user ID to drill counts
		const drillCountsMap = new Map(
			drillCounts.map((dc) => [
				dc._id.toString(),
				{
					drillsTotal: dc.totalAssigned,
					drillsCompleted: dc.completed,
					drillsActive: dc.pending + dc.inProgress,
				},
			])
		);

		// Map to students format with profile info and drill counts
		const students = users.map((user) => {
			const counts = drillCountsMap.get(user._id.toString()) || {
				drillsTotal: 0,
				drillsCompleted: 0,
				drillsActive: 0,
			};
			
			// Calculate progress percentage
			const progress = counts.drillsTotal > 0
				? Math.round((counts.drillsCompleted / counts.drillsTotal) * 100)
				: 0;

			return {
				...user,
				userId: user,
				drillsTotal: counts.drillsTotal,
				drillsCompleted: counts.drillsCompleted,
				drillsActive: counts.drillsActive,
				progress,
			};
		});

		logger.info('Students fetched successfully for tutor', {
			tutorId: context.userId,
			total: students.length,
		});

		return NextResponse.json(
			{
				limit,
				offset,
				total,
				students,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching students for tutor', error);
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

export const GET = withRole(['tutor'], handler);
