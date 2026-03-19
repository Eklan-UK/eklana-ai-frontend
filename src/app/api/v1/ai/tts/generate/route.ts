// POST /api/v1/ai/tts/generate
// Generate TTS audio stream
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import { generateElevenLabsAudio, TTSProviderError } from '@/services/tts-provider.service';

const generateTTSSchema = z.object({
	text: z.string().min(1).max(5000),
	voiceId: z.string().optional(),
	modelId: z.string().optional(),
	stability: z.number().min(0).max(1).optional(),
	similarityBoost: z.number().min(0).max(1).optional(),
	style: z.number().min(0).max(1).optional(),
	useSpeakerBoost: z.boolean().optional(),
});

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const startedAt = Date.now();
		const body = await req.json();
		const validated = generateTTSSchema.parse(body);
		const audioBuffer = await generateElevenLabsAudio({
			text: validated.text,
			voiceId: validated.voiceId,
			modelId: validated.modelId,
			stability: validated.stability,
			similarityBoost: validated.similarityBoost,
			style: validated.style,
			useSpeakerBoost: validated.useSpeakerBoost,
		});

		return new NextResponse(audioBuffer, {
			headers: {
				'Content-Type': 'audio/mpeg',
				'Cache-Control': 'no-cache',
				'X-TTS-Telemetry': JSON.stringify({
					route: '/api/v1/ai/tts/generate',
					provider_status: 200,
					cache_hit: false,
					voice_id: validated.voiceId || 'default',
					text_len: validated.text.length,
					latency_ms: Date.now() - startedAt,
				}),
			},
		});
	} catch (error: any) {
		if (error instanceof TTSProviderError) {
			return NextResponse.json(
				{ code: error.code, message: error.message },
				{ status: error.status }
			);
		}
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

		logger.error('Error generating TTS', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message?.includes('429') || error.message?.includes('quota')
					? 'Voice service is temporarily busy. Please try again in a moment.'
					: 'Failed to generate audio. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

