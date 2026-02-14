// POST /api/v1/tts/batch
// Batch TTS generation for Daily Focus - generates audio for multiple texts
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import TTSCache from '@/models/tts-cache';
import { logger } from '@/lib/api/logger';
import { config } from '@/lib/api/config';
import crypto from 'crypto';
import { Types } from 'mongoose';

// Generate hash for cache lookup
function generateHash(text: string, voice: string): string {
  const normalized = text.trim().toLowerCase();
  return crypto
    .createHash('md5')
    .update(`${normalized}:${voice}`)
    .digest('hex');
}

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

async function generateSingleTTS(
  text: string,
  voice: string,
  elevenLabsApiKey: string,
  cloudinaryConfig: { apiKey: string; apiSecret: string; cloudName: string } | null
): Promise<{ audioUrl: string | null; cached: boolean; error?: string }> {
  const textHash = generateHash(text, voice);

  // Check cache first
  const cached = await TTSCache.findOneAndUpdate(
    { textHash },
    {
      $inc: { hitCount: 1 },
      $set: { lastAccessedAt: new Date() },
    },
    { new: true }
  )
    .lean()
    .exec();

  if (cached) {
    return { audioUrl: cached.audioUrl, cached: true };
  }

  // Generate new audio via ElevenLabs
  const voiceId = voice === 'default' ? '21m00Tcm4TlvDq8ikWAM' : voice;

  const elevenLabsResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!elevenLabsResponse.ok) {
    const errorText = await elevenLabsResponse.text();
    logger.error('ElevenLabs API error in batch', { status: elevenLabsResponse.status, error: errorText });
    return { audioUrl: null, cached: false, error: 'TTS generation failed' };
  }

  const audioBuffer = await elevenLabsResponse.arrayBuffer();
  const fileSize = audioBuffer.byteLength;

  // If no Cloudinary config, we can't cache
  if (!cloudinaryConfig) {
    return { audioUrl: null, cached: false, error: 'Cloudinary not configured' };
  }

  const { apiKey, apiSecret, cloudName } = cloudinaryConfig;

  // Upload to Cloudinary
  const timestamp = Math.round(Date.now() / 1000);
  const signatureString = `folder=tts_cache&public_id=tts_${textHash}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const uploadFormData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  uploadFormData.append('file', audioBlob, `tts_${textHash}.mp3`);
  uploadFormData.append('api_key', apiKey);
  uploadFormData.append('timestamp', timestamp.toString());
  uploadFormData.append('signature', signature);
  uploadFormData.append('folder', 'tts_cache');
  uploadFormData.append('public_id', `tts_${textHash}`);
  uploadFormData.append('resource_type', 'video');

  const cloudinaryResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    {
      method: 'POST',
      body: uploadFormData,
    }
  );

  if (!cloudinaryResponse.ok) {
    const errorText = await cloudinaryResponse.text();
    logger.error('Cloudinary upload failed in batch', { error: errorText });
    return { audioUrl: null, cached: false, error: 'Upload failed' };
  }

  const cloudinaryData = await cloudinaryResponse.json();
  const audioUrl = cloudinaryData.secure_url;
  const duration = cloudinaryData.duration;

  // Save to cache
  await TTSCache.create({
    textHash,
    text,
    voice,
    audioUrl,
    duration,
    fileSize,
    hitCount: 1,
    lastAccessedAt: new Date(),
  });

  return { audioUrl, cached: false };
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

    await connectToDatabase();

    const elevenLabsApiKey = config.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
    if (!elevenLabsApiKey) {
      logger.warn('ELEVEN_LABS_API_KEY not configured - returning empty results');
      // Return success with no audio URLs instead of failing
      return NextResponse.json({
        code: 'Success',
        data: {
          results: validTexts.map((t) => ({
            id: t.id,
            text: t.text,
            audioUrl: null,
            cached: false,
            error: 'TTS service not configured',
          })),
          summary: {
            total: validTexts.length,
            success: 0,
            cached: 0,
            generated: 0,
            failed: validTexts.length,
          },
        },
        warning: 'TTS service not configured - ELEVENLABS_API_KEY missing',
      });
    }

    // Parse Cloudinary config
    let cloudinaryConfig: { apiKey: string; apiSecret: string; cloudName: string } | null = null;
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (cloudinaryUrl) {
      const cloudinaryMatch = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
      if (cloudinaryMatch) {
        cloudinaryConfig = {
          apiKey: cloudinaryMatch[1],
          apiSecret: cloudinaryMatch[2],
          cloudName: cloudinaryMatch[3],
        };
      } else {
        logger.warn('CLOUDINARY_URL format invalid, caching disabled');
      }
    } else {
      logger.warn('CLOUDINARY_URL not configured, caching disabled');
    }

    logger.info('Starting batch TTS generation', {
      count: validTexts.length,
      userId: context.userId,
    });

    // Process texts sequentially to avoid rate limiting
    const results: BatchTTSResult[] = [];

    for (const item of validTexts) {
      try {
        const result = await generateSingleTTS(
          item.text,
          voice,
          elevenLabsApiKey,
          cloudinaryConfig
        );
        results.push({
          id: item.id,
          text: item.text,
          audioUrl: result.audioUrl,
          cached: result.cached,
          error: result.error,
        });

        // Small delay to avoid rate limiting (100ms between requests)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        logger.error('Error processing TTS item', { id: item.id, error: error.message });
        results.push({
          id: item.id,
          text: item.text,
          audioUrl: null,
          cached: false,
          error: error.message,
        });
      }
    }

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

