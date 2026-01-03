// GET /api/v1/ai/tts/voices
// Get available TTS voices
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { getAvailableVoices } from '@/services/tts.service';
import { logger } from '@/lib/api/logger';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const voices = await getAvailableVoices();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Voices retrieved successfully',
				data: {
					voices,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching voices', {
			error: error.message,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Failed to retrieve voices',
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(handler);

