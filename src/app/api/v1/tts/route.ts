import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/api/logger';
import { withAuth } from '@/lib/api/middleware';
import { findCachedTTS, findCachedTTSReadOnly, persistTTSInCache } from '@/services/tts-cache.service';
import { generateElevenLabsAudio, TTSProviderError } from '@/services/tts-provider.service';

const requestWindowMs = 60_000;
const maxRequestsPerWindow = 30;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(identity: string): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(identity);
  if (!bucket || now >= bucket.resetAt) {
    requestBuckets.set(identity, { count: 1, resetAt: now + requestWindowMs });
    return true;
  }
  if (bucket.count >= maxRequestsPerWindow) {
    return false;
  }
  bucket.count += 1;
  return true;
}

async function postHandler(
  req: NextRequest,
  context: { userId: any; userRole: string }
) {
  try {
    const startedAt = Date.now();
    const body = await req.json();
    const { text, voice = 'default' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Text is required' },
        { status: 400 }
      );
    }

    // Limit text length
    if (text.length > 5000) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Text too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    const identity = `${context.userId?.toString() || 'anon'}:${getClientIp(req)}`;
    if (!checkRateLimit(identity)) {
      return NextResponse.json(
        { code: 'RateLimited', message: 'Too many TTS requests. Please retry shortly.' },
        { status: 429 }
      );
    }

    const { textHash, cached } = await findCachedTTS(text, voice);

    if (cached) {
      logger.info('TTS cache hit', { textHash, hitCount: cached.hitCount });
      return NextResponse.json({
        code: 'Success',
        data: {
          audioUrl: cached.audioUrl,
          cached: true,
          hitCount: cached.hitCount,
          telemetry: {
            route: '/api/v1/tts',
            provider_status: 'cache',
            cache_hit: true,
            voice_id: voice,
            text_len: text.length,
            latency_ms: Date.now() - startedAt,
          },
        },
      });
    }

    // Cache miss - generate new audio
    logger.info('TTS cache miss, generating new audio', { textHash, textLength: text.length });

    const audioBuffer = await generateElevenLabsAudio({ text, voiceId: voice });
    const fileSize = audioBuffer.byteLength;
    const persisted = await persistTTSInCache({
      textHash,
      text,
      voice,
      audioBuffer,
    });

    if (!persisted) {
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-TTS-Cached': 'false',
          'X-TTS-Telemetry': JSON.stringify({
            route: '/api/v1/tts',
            provider_status: 200,
            cache_hit: false,
            voice_id: voice,
            text_len: text.length,
            latency_ms: Date.now() - startedAt,
          }),
        },
      });
    }

    return NextResponse.json({
      code: 'Success',
      data: {
        audioUrl: persisted.audioUrl,
        cached: false,
        duration: persisted.duration,
        telemetry: {
          route: '/api/v1/tts',
          provider_status: 200,
          cache_hit: false,
          voice_id: voice,
          text_len: text.length,
          latency_ms: Date.now() - startedAt,
          file_size: fileSize,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof TTSProviderError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status }
      );
    }
    logger.error('TTS generation error', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { code: 'ServerError', message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}

// GET - Check if text is cached (useful for prefetching)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const voice = searchParams.get('voice') || 'default';

    if (!text) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Text parameter required' },
        { status: 400 }
      );
    }

    const { cached } = await findCachedTTSReadOnly(text, voice);

    if (cached) {
      return NextResponse.json({
        code: 'Success',
        data: {
          cached: true,
          audioUrl: cached.audioUrl,
        },
      });
    }

    return NextResponse.json({
      code: 'Success',
      data: {
        cached: false,
        audioUrl: null,
      },
    });
  } catch (error: any) {
    logger.error('TTS cache check error', { error: error.message });
    return NextResponse.json(
      { code: 'ServerError', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);


