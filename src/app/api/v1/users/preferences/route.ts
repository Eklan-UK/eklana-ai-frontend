// PATCH /api/v1/users/preferences
// Update user's learning preferences stored in the Profile model
// (nationality, language, learningGoal)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import ProfileModel from '@/models/profile';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { z } from 'zod';

const preferencesSchema = z.object({
	nationality: z.string().optional(),
	language: z.string().optional(),
	learningGoal: z.string().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const validated = preferencesSchema.parse(body);

		// Find and update the user's Profile document
		const profile = await ProfileModel.findOneAndUpdate(
			{ userId: context.userId },
			{ $set: validated },
			{ new: true, upsert: false }
		).lean().exec();

		if (!profile) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Profile not found. Please complete onboarding first.',
				},
				{ status: 404 }
			);
		}

		logger.info('User preferences updated', {
			userId: context.userId,
			updatedFields: Object.keys(validated),
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Preferences updated successfully',
				data: {
					nationality: profile.nationality,
					language: profile.language,
					learningGoal: profile.learningGoal,
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

		logger.error('Error updating preferences', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to update preferences',
			},
			{ status: 500 }
		);
	}
}

export const PATCH = withAuth(handler);
