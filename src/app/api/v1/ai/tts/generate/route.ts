// POST /api/v1/ai/tts/generate
// Generate TTS audio stream
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import config from '@/lib/api/config';

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
		const body = await req.json();
		const validated = generateTTSSchema.parse(body);

		// Check if API key is configured
		const apiKey = config.ELEVEN_LABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
		if (!apiKey) {
			logger.error('Eleven Labs API key not configured');
			return NextResponse.json(
				{
					code: 'ConfigurationError',
					message: 'Eleven Labs API key is not configured. Please set ELEVEN_LABS_API_KEY environment variable.',
				},
				{ status: 500 }
			);
		}

		// Create a streaming response
		const stream = new ReadableStream({
			async start(controller) {
				try {
					const voiceId = validated.voiceId || '21m00Tcm4TlvDq8ikWAM';
					const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
					
					const response = await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'xi-api-key': apiKey,
						},
						body: JSON.stringify({
							text: validated.text,
							model_id: validated.modelId || 'eleven_multilingual_v2',
							voice_settings: {
								stability: validated.stability || 0.5,
								similarity_boost: validated.similarityBoost || 0.75,
								style: validated.style || 0.0,
								use_speaker_boost: validated.useSpeakerBoost !== undefined ? validated.useSpeakerBoost : true,
							},
						}),
					});

					if (!response.ok) {
						const errorText = await response.text().catch(() => response.statusText);
						logger.error('Eleven Labs API error', {
							status: response.status,
							statusText: response.statusText,
							error: errorText,
						});
						
						if (response.status === 401) {
							throw new Error('Eleven Labs API key is invalid or expired. Please check your ELEVEN_LABS_API_KEY environment variable.');
						}
						
						throw new Error(`Eleven Labs API error (${response.status}): ${errorText || response.statusText}`);
					}

					// Stream the audio
					const reader = response.body?.getReader();
					if (!reader) {
						throw new Error('No response body');
					}

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						controller.enqueue(value);
					}

					controller.close();
				} catch (error: any) {
					controller.error(error);
				}
			},
		});

		return new NextResponse(stream, {
			headers: {
				'Content-Type': 'audio/mpeg',
				'Cache-Control': 'no-cache',
			},
		});
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

		logger.error('Error generating TTS', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to generate audio',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

