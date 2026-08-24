// GET /api/v1/users/preferences — read learning preferences from Profile
// PATCH /api/v1/users/preferences — update learning preferences on Profile
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import ProfileModel from '@/models/profile';
import { logger } from '@/lib/api/logger';
import { validateTimezone } from '@/lib/timezone/validate-timezone';
import { Types } from 'mongoose';
import { z } from 'zod';
import { toStudentLessonAccent } from '@/services/tts-accent-voices';

const preferencesSchema = z.object({
	nationality: z.string().optional(),
	language: z.string().optional(),
	nativeLanguage: z.string().optional(),
	learningGoal: z.string().optional(),
	learningGoals: z.array(z.string()).optional(),
	theme: z.enum(['system', 'light', 'dark']).optional(),
	timezone: z.string().min(1).optional(),
	notificationPreferences: z.object({
		learningReminders: z.boolean(),
		specialOffers: z.boolean(),
		subscriptionExpires: z.boolean(),
	}).optional(),
	lessonPreferences: z.object({
		eklanTalks: z.boolean().optional(),
		chatTranslation: z.boolean().optional(),
		englishAccent: z.string().optional(),
		voiceTone: z.string().optional(),
		speakingSpeed: z.string().optional(),
	}).optional(),
});

function profilePreferencesPayload(profile: {
	nationality?: string;
	language?: string;
	nativeLanguage?: string;
	learningGoal?: string;
	learningGoals?: string[];
	theme?: string;
	timezone?: string;
	notificationPreferences?: {
		learningReminders: boolean;
		specialOffers: boolean;
		subscriptionExpires: boolean;
	};
	lessonPreferences?: {
		eklanTalks: boolean;
		chatTranslation: boolean;
		englishAccent: string;
		voiceTone: string;
		speakingSpeed: string;
	};
}) {
	return {
		nationality: profile.nationality,
		language: profile.language,
		nativeLanguage: profile.nativeLanguage,
		learningGoal: profile.learningGoal,
		learningGoals: profile.learningGoals,
		theme: profile.theme,
		timezone: profile.timezone,
		notificationPreferences: profile.notificationPreferences,
		lessonPreferences: profile.lessonPreferences,
	};
}

async function getHandler(
	_req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const profile = await ProfileModel.findOne({ userId: context.userId })
			.select(
				'nationality language nativeLanguage learningGoal learningGoals theme timezone notificationPreferences lessonPreferences',
			)
			.lean()
			.exec();

		if (!profile) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Profile not found. Please complete onboarding first.',
				},
				{ status: 404 },
			);
		}

		return NextResponse.json(
			{
				code: 'Success',
				data: profilePreferencesPayload(profile),
			},
			{ status: 200 },
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Failed to load preferences';
		logger.error('Error loading preferences', {
			error: message,
			userId: context.userId,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message,
			},
			{ status: 500 },
		);
	}
}

async function patchHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const validated = preferencesSchema.parse(body);

		if (validated.timezone && !validateTimezone(validated.timezone)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Invalid IANA timezone',
				},
				{ status: 400 },
			);
		}

		const update: Record<string, unknown> = { ...validated };

		// Coerce student lesson accent to country accent keys (`*_female`) only.
		if (validated.lessonPreferences?.englishAccent !== undefined) {
			update.lessonPreferences = {
				...validated.lessonPreferences,
				englishAccent: toStudentLessonAccent(
					validated.lessonPreferences.englishAccent,
				),
			};
		}

		// Bootstrap only: do not overwrite an existing timezone choice.
		if (validated.timezone) {
			const existing = await ProfileModel.findOne({ userId: context.userId })
				.select('timezone')
				.lean()
				.exec();
			if (existing?.timezone) {
				delete update.timezone;
			}
		}

		const profile = await ProfileModel.findOneAndUpdate(
			{ userId: context.userId },
			{ $set: update },
			{ new: true, upsert: false },
		)
			.select(
				'nationality language nativeLanguage learningGoal learningGoals theme timezone notificationPreferences lessonPreferences',
			)
			.lean()
			.exec();

		if (!profile) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Profile not found. Please complete onboarding first.',
				},
				{ status: 404 },
			);
		}

		logger.info('User preferences updated', {
			userId: context.userId,
			updatedFields: Object.keys(update),
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Preferences updated successfully',
				data: profilePreferencesPayload(profile),
			},
			{ status: 200 },
		);
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Validation failed',
					errors: error.issues,
				},
				{ status: 400 },
			);
		}

		const message = error instanceof Error ? error.message : 'Failed to update preferences';
		logger.error('Error updating preferences', {
			error: message,
			userId: context.userId,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message,
			},
			{ status: 500 },
		);
	}
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
