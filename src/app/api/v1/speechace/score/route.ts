// POST /api/v1/speechace/score
// Score pronunciation using Speechace API
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // Allow up to 5 min for Speechace to process long audio
import { withAuth } from '@/lib/api/middleware';
import {
	speechaceService,
	isSpeechaceApiError,
	isSpeechaceAudioTooLargeError,
} from '@/lib/api/speechace.service';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

/** Pull MIME from a data-URL prefix when present (e.g. data:audio/m4a;base64,...). */
function mimeFromDataUrl(audioBase64: string): string | undefined {
	const match = /^data:(audio\/[^;]+);base64,/i.exec(audioBase64);
	return match?.[1]?.toLowerCase();
}

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const { text, audioBase64, questionInfo, mimeType: bodyMimeType } = body;

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
		if (text.length > 1500) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Text must be less than 1500 characters',
				},
				{ status: 400 }
			);
		}

		const dataUrlMime = mimeFromDataUrl(audioBase64);
		const clientMimeType =
			(typeof bodyMimeType === 'string' && bodyMimeType.trim()) ||
			dataUrlMime ||
			undefined;

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
			questionInfo,
			clientMimeType
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
			code: error.code,
			short_message: error.short_message,
		});

		if (isSpeechaceAudioTooLargeError(error)) {
			return NextResponse.json(
				{
					code: error.code,
					message: error.message,
				},
				{ status: error.httpStatus }
			);
		}

		if (isSpeechaceApiError(error)) {
			// Prefer 422 with SpeechAce fields so mobile can map error_no_speech
			// without relying on opaque 500. Include short_message in `message`
			// so clients that only parse message text still detect it.
			const message =
				error.short_message && !error.message.includes(error.short_message)
					? `${error.short_message}: ${error.message}`
					: error.message;

			return NextResponse.json(
				{
					code: error.code,
					message,
					short_message: error.short_message,
					detail_message: error.detail_message,
				},
				{ status: error.httpStatus }
			);
		}

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
