import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { generateGeminiTTSAudio } from '@/services/gemini.service';

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
  if (bucket.count >= maxRequestsPerWindow) return false;
  bucket.count += 1;
  return true;
}

async function postHandler(
  req: NextRequest,
  context: { userId: any; userRole: string },
) {
  try {
    const body = await req.json();
    const { text, voice } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Text is required' },
        { status: 400 },
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Text too long (max 5000 characters)' },
        { status: 400 },
      );
    }

    const identity = `pt_tts:${context.userId?.toString() || 'anon'}:${getClientIp(req)}`;
    if (!checkRateLimit(identity)) {
      return NextResponse.json(
        { code: 'RateLimited', message: 'Too many TTS requests. Please retry shortly.' },
        { status: 429 },
      );
    }

    // Map 'default' or empty to a valid Gemini voice name
    const voiceName = typeof voice === 'string' && voice && voice !== 'default' ? voice : 'Kore';

    const audioBuffer = await generateGeminiTTSAudio(text, voiceName);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { code: 'ServerError', message: 'Failed to generate speech', error: error.message },
      { status: 500 },
    );
  }
}

export const POST = withAuth(postHandler);
