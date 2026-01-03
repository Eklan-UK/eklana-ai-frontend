// POST /api/v1/speechace/score
// Score pronunciation using Speechace API
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { speechaceService } from '@/lib/api/speechace.service';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const { text, audioBase64, questionInfo } = body;

		// Validation
		if (!text || typeof text !== 'string') {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Text is required and must be a string',
				},
				{ status: 400 }
			);
		}

		if (!audioBase64 || typeof audioBase64 !== 'string') {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Audio data (base64) is required',
				},
				{ status: 400 }
			);
		}

		// Validate text length
		if (text.length > 500) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Text must be less than 500 characters',
				},
				{ status: 400 }
			);
		}

		// Validate base64 format
		const base64Regex = /^data:audio\/[^;]+;base64,/;
		let cleanAudioBase64 = audioBase64;

		// Remove data URL prefix if present
		if (base64Regex.test(audioBase64)) {
			cleanAudioBase64 = audioBase64.split(',')[1];
		}

		// Call Speechace service
		const result = await speechaceService.scorePronunciation(
			text,
			cleanAudioBase64,
			context.userId.toString(),
			questionInfo
		);

		logger.info('Pronunciation scored successfully', {
			userId: context.userId.toString(),
			text,
			score: result.text_score,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation scored successfully',
				data: result,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error scoring pronunciation', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to score pronunciation',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);


