// POST /api/v1/simulation/audio/wav — wrap raw PCM (24kHz, 16-bit, mono, as
// streamed by the Live API via /turn's 'audio' SSE chunks) in a WAV header so
// the browser can play it. Reuses the same conversion gemini.service.ts already
// applies server-side for non-streaming Live API responses and TTS audio.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import { pcmToWavBase64, combineBase64Chunks } from '@/services/gemini.service';

const bodySchema = z.object({
	pcmBase64Chunks: z.array(z.string()).min(1, 'pcmBase64Chunks must contain at least one chunk'),
});

async function handler(req: NextRequest): Promise<NextResponse> {
	try {
		const body = await req.json();
		const { pcmBase64Chunks } = bodySchema.parse(body);

		const combined = combineBase64Chunks(pcmBase64Chunks);
		const wavBase64 = pcmToWavBase64(combined);

		return NextResponse.json({ code: 'Success', data: { wavBase64 } }, { status: 200 });
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstIssue = error.issues?.[0];
			return NextResponse.json(
				{ code: 'ValidationError', message: firstIssue?.message ?? 'Invalid input' },
				{ status: 400 },
			);
		}
		logger.error('[SimulationAudioWav] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to convert audio' },
			{ status: 500 },
		);
	}
}

export const POST = withRole(['user'], handler);
