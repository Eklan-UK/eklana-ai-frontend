import crypto from 'crypto';
import TTSCache from '@/models/tts-cache';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { uploadToCloudinary } from '@/services/cloudinary.service';

export function generateTTSHash(text: string, voice: string): string {
  const normalized = text.trim().toLowerCase();
  return crypto.createHash('md5').update(`${normalized}:${voice}`).digest('hex');
}

export async function findCachedTTS(text: string, voice: string) {
  await connectToDatabase();
  const textHash = generateTTSHash(text, voice);
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
  return { textHash, cached };
}

export async function findCachedTTSReadOnly(text: string, voice: string) {
  await connectToDatabase();
  const textHash = generateTTSHash(text, voice);
  const cached = await TTSCache.findOne({ textHash }).select('audioUrl').lean().exec();
  return { textHash, cached };
}

export async function persistTTSInCache(params: {
  textHash: string;
  text: string;
  voice: string;
  audioBuffer: ArrayBuffer;
}): Promise<{ audioUrl: string; duration?: number; fileSize: number } | null> {
  // Cloudinary-based caching is disabled for TTS generation to favor speed.
  // We still keep the hashing helpers for possible future use, but skip uploads entirely.
  logger.info('TTS Cloudinary cache disabled, returning uncached audio', {
    textHash: params.textHash,
    textLength: params.text.length,
    voice: params.voice,
  });
  return null;
}

