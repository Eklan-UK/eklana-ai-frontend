// POST /api/v1/ai/voice
// Transcribes a base64-encoded audio recording sent by the mobile app (Free Talk, AI Talk).
// The client sends { audioData, history, context } as JSON; we decode and forward to Gemini STT.
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { transcribeAudio } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';

export const maxDuration = 30;

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string },
): Promise<NextResponse> {
	void context;
	try {
		const body = await req.json();
		const { audioData } = body as { audioData?: string; history?: unknown; context?: string };

		if (!audioData || typeof audioData !== 'string' || !audioData.trim()) {
			return NextResponse.json(
				{ code: 'Error', message: 'audioData is required' },
				{ status: 400 },
			);
		}

		const audioBuffer = Buffer.from(audioData, 'base64');

		logger.info('[Voice] Transcribing audio', {
			userId: context.userId,
			base64Length: audioData.length,
			bufferBytes: audioBuffer.length,
		});

		// m4a from the mobile device → audio/mp4 MIME accepted natively by Gemini
		const transcript = await transcribeAudio(audioBuffer, 'audio/mp4');

		return NextResponse.json({ code: 'Success', data: transcript });
	} catch (error: any) {
		logger.error('[Voice] Transcription failed', {
			error: error?.message,
			stack: error?.stack,
		});

		let message = 'Failed to transcribe audio';
		if (error?.message?.includes('429') || error?.message?.includes('quota')) {
			message = 'Voice service is temporarily busy. Please try again in a moment.';
		} else if (error?.message?.includes('timeout') || error?.message?.includes('DEADLINE')) {
			message = 'Transcription took too long. Please try a shorter recording.';
		}

		return NextResponse.json({ code: 'Error', message }, { status: 500 });
	}
}

export const POST = withAuth(handler);
