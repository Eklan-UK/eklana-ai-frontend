import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { findCachedTTS, persistTTSInCache } from '@/services/tts-cache.service';
import { generateElevenLabsAudio } from '@/services/tts-provider.service';

interface BatchTTSRequest {
  texts: Array<{
    id: string; // Identifier for matching response to request
    text: string;
  }>;
  voice?: string;
}

interface BatchTTSResult {
  id: string;
  text: string;
  audioUrl: string | null;
  cached: boolean;
  error?: string;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateSingleTTS(
  text: string,
  voice: string
): Promise<{ audioUrl: string | null; cached: boolean; error?: string }> {
  const { textHash, cached } = await findCachedTTS(text, voice);
  if (cached) return { audioUrl: cached.audioUrl, cached: true };

  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const audioBuffer = await generateElevenLabsAudio({ text, voiceId: voice });
      const persisted = await persistTTSInCache({ textHash, text, voice, audioBuffer });
      if (!persisted) {
        return { audioUrl: null, cached: false, error: 'Cloudinary not configured' };
      }
      return { audioUrl: persisted.audioUrl, cached: false };
    } catch (error: any) {
      lastError = error;
      const status = error?.status || 500;
      if (status !== 429 || attempt === 3) {
        break;
      }
      await sleep(250 * attempt);
    }
  }

  return {
    audioUrl: null,
    cached: false,
    error: lastError?.message || 'TTS generation failed',
  };
}

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    const body: BatchTTSRequest = await req.json();
    const { texts, voice = 'default' } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Texts array is required' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (texts.length > 50) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Maximum 50 texts per batch' },
        { status: 400 }
      );
    }

    // Filter out empty texts
    const validTexts = texts.filter((t) => t.text && t.text.trim().length > 0);

    if (validTexts.length === 0) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'No valid texts provided' },
        { status: 400 }
      );
    }

    logger.info('Starting batch TTS generation', {
      count: validTexts.length,
      userId: context.userId,
    });

    const queue = [...validTexts];
    const results: BatchTTSResult[] = [];
    const workerCount = Math.min(3, queue.length);

    await Promise.all(
      Array.from({ length: workerCount }).map(async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          try {
            const result = await generateSingleTTS(item.text, voice);
            results.push({
              id: item.id,
              text: item.text,
              audioUrl: result.audioUrl,
              cached: result.cached,
              error: result.error,
            });
          } catch (error: any) {
            results.push({
              id: item.id,
              text: item.text,
              audioUrl: null,
              cached: false,
              error: error.message,
            });
          }
          await sleep(80);
        }
      })
    );

    const successCount = results.filter((r) => r.audioUrl).length;
    const cachedCount = results.filter((r) => r.cached).length;

    logger.info('Batch TTS generation complete', {
      total: results.length,
      success: successCount,
      cached: cachedCount,
      generated: successCount - cachedCount,
    });

    return NextResponse.json({
      code: 'Success',
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          cached: cachedCount,
          generated: successCount - cachedCount,
          failed: results.length - successCount,
        },
        telemetry: {
          route: '/api/v1/tts/batch',
          provider_status: 'mixed',
          cache_hit: cachedCount > 0,
          voice_id: voice,
          text_len: validTexts.reduce((acc, item) => acc + item.text.length, 0),
        },
      },
    });
  } catch (error: any) {
    logger.error('Batch TTS generation error', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { code: 'ServerError', message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

// Only admin and tutor can batch generate TTS
export const POST = withRole(['admin', 'tutor'], handler);

