// POST /api/v1/ai/free-talk/tts
// Generates TTS audio for the Free Talk situation text using Gemini native TTS.
// Returns a WAV audio body directly — no ElevenLabs dependency.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { generateGeminiTTSAudio } from '@/services/gemini.service';

async function handler(req: NextRequest): Promise<NextResponse> {
	try {
		const { text } = await req.json() as { text?: string };
		if (!text || typeof text !== 'string' || !text.trim()) {
			return NextResponse.json({ success: false, message: 'text is required' }, { status: 400 });
		}
		if (text.length > 2000) {
			return NextResponse.json({ success: false, message: 'text too long' }, { status: 400 });
		}

		const audioBuffer = await generateGeminiTTSAudio(text.trim(), 'Kore');

		return new NextResponse(audioBuffer, {
			headers: {
				'Content-Type': 'audio/wav',
				'Cache-Control': 'no-cache',
			},
		});
	} catch (error: any) {
		logger.error('[FreeTalk TTS] Error generating audio', {
			error: error?.message,
			stack: error?.stack,
		});
		return NextResponse.json(
			{
				success: false,
				message:
					error?.message?.includes('429') || error?.message?.includes('quota')
						? 'Voice service is temporarily busy. Please try again.'
						: 'Failed to generate audio. Please try again.',
			},
			{ status: 500 },
		);
	}
}

export const POST = withPremium(handler);

export const maxDuration = 60;
