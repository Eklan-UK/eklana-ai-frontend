// POST /api/v1/ai/free-talk/tts
// Generates TTS audio for the Free Talk situation text using ElevenLabs,
// resolved from the authenticated user's lesson englishAccent preference.
import { NextRequest, NextResponse } from 'next/server';
import { withPremium } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import ProfileModel from '@/models/profile';
import { generateElevenLabsAudio, TTSProviderError } from '@/services/tts-provider.service';
import { resolveVoiceId } from '@/services/tts-config';
import { resolveAccentVoiceId } from '@/services/tts-accent-voices';

async function handler(
	req: NextRequest,
	context: { userId: string; userRole: string },
): Promise<NextResponse> {
	try {
		const { text } = (await req.json()) as { text?: string };
		if (!text || typeof text !== 'string' || !text.trim()) {
			return NextResponse.json({ success: false, message: 'text is required' }, { status: 400 });
		}
		if (text.length > 2000) {
			return NextResponse.json({ success: false, message: 'text too long' }, { status: 400 });
		}

		await connectToDatabase();
		const profile = await ProfileModel.findOne({ userId: context.userId })
			.select('lessonPreferences.englishAccent')
			.lean()
			.exec();

		const accentVoiceId = resolveAccentVoiceId(
			profile?.lessonPreferences?.englishAccent,
		);
		const voiceId = resolveVoiceId(accentVoiceId);

		const audioBuffer = await generateElevenLabsAudio({
			text: text.trim(),
			voiceId,
		});

		return new NextResponse(new Uint8Array(audioBuffer), {
			headers: {
				'Content-Type': 'audio/mpeg',
				'Cache-Control': 'no-cache',
			},
		});
	} catch (error: any) {
		if (error instanceof TTSProviderError) {
			return NextResponse.json(
				{ success: false, message: error.message },
				{ status: error.status },
			);
		}
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
