// POST /api/v1/tts
// TTS generation with caching - checks cache first, generates if not found
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import TTSCache from '@/models/tts-cache';
import { logger } from '@/lib/api/logger';
import crypto from 'crypto';

// Generate hash for cache lookup
function generateHash(text: string, voice: string): string {
  const normalized = text.trim().toLowerCase();
  return crypto
    .createHash('md5')
    .update(`${normalized}:${voice}`)
    .digest('hex');
}

export async function POST(req: NextRequest) {
  try {
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

    await connectToDatabase();

    // Generate hash for cache lookup
    const textHash = generateHash(text, voice);

    // Check cache first
    const cached = await TTSCache.findOneAndUpdate(
      { textHash },
      { 
        $inc: { hitCount: 1 },
        $set: { lastAccessedAt: new Date() }
      },
      { new: true }
    ).lean().exec();

    if (cached) {
      logger.info('TTS cache hit', { textHash, hitCount: cached.hitCount });
      return NextResponse.json({
        code: 'Success',
        data: {
          audioUrl: cached.audioUrl,
          cached: true,
          hitCount: cached.hitCount,
        },
      });
    }

    // Cache miss - generate new audio
    logger.info('TTS cache miss, generating new audio', { textHash, textLength: text.length });

    // Call ElevenLabs API
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { code: 'ConfigError', message: 'TTS service not configured' },
        { status: 500 }
      );
    }

    // Default voice ID - Rachel (clear, natural voice)
    const voiceId = voice === 'default' 
      ? '21m00Tcm4TlvDq8ikWAM' // Rachel
      : voice;

    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      logger.error('ElevenLabs API error', { status: elevenLabsResponse.status, error: errorText });
      return NextResponse.json(
        { code: 'TTSError', message: 'Failed to generate audio' },
        { status: 500 }
      );
    }

    // Get audio buffer
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const fileSize = audioBuffer.byteLength;

    // Upload to Cloudinary
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
      // If no Cloudinary, return audio directly (not cached)
      logger.warn('Cloudinary not configured, returning audio directly');
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-TTS-Cached': 'false',
        },
      });
    }

    // Parse Cloudinary URL
    const cloudinaryMatch = cloudinaryUrl.match(
      /cloudinary:\/\/(\d+):([^@]+)@(.+)/
    );
    if (!cloudinaryMatch) {
      logger.error('Invalid Cloudinary URL format');
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-TTS-Cached': 'false',
        },
      });
    }

    const [, apiKey, apiSecret, cloudName] = cloudinaryMatch;

    // Upload to Cloudinary
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    formData.append('file', audioBlob, `tts_${textHash}.mp3`);
    formData.append('upload_preset', 'ml_default');
    formData.append('resource_type', 'video'); // Cloudinary uses 'video' for audio
    formData.append('folder', 'tts_cache');
    formData.append('public_id', `tts_${textHash}`);

    // Generate signature for authenticated upload
    const timestamp = Math.round(Date.now() / 1000);
    const signatureString = `folder=tts_cache&public_id=tts_${textHash}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

    const uploadFormData = new FormData();
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
      logger.error('Cloudinary upload failed', { error: errorText });
      // Return audio directly without caching
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-TTS-Cached': 'false',
        },
      });
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

    logger.info('TTS audio generated and cached', { textHash, audioUrl });

    return NextResponse.json({
      code: 'Success',
      data: {
        audioUrl,
        cached: false,
        duration,
      },
    });
  } catch (error: any) {
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

    await connectToDatabase();

    const textHash = generateHash(text, voice);
    const cached = await TTSCache.findOne({ textHash }).select('audioUrl').lean().exec();

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


