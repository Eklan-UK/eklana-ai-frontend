// POST /api/v1/ai/transcribe
// Transcribe audio to text using Gemini
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { transcribeAudio } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';

export const maxDuration = 30;

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const formData = await req.formData();
		const audioFile = formData.get('audio') as File;

		if (!audioFile) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Audio file is required' },
				{ status: 400 }
			);
		}

		const arrayBuffer = await audioFile.arrayBuffer();
		const audioBuffer = Buffer.from(arrayBuffer);
		const mimeType = audioFile.type || 'audio/webm';

		logger.info('Transcribing audio', {
			size: audioBuffer.length,
			mimeType,
			userId: context.userId,
		});

		const transcription = await transcribeAudio(audioBuffer, mimeType);

		return NextResponse.json({
			code: 'Success',
			message: 'Audio transcribed successfully',
			data: { transcription },
		});
	} catch (error: any) {
		logger.error('Error transcribing audio:', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to transcribe audio',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);


