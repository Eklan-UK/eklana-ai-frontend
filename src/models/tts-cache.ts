// models/tts-cache.model.ts
// Cache for TTS audio to minimize ElevenLabs API calls
import { Schema, model, models, Document, Types } from 'mongoose';

export interface ITTSCache extends Document {
  _id: Types.ObjectId;
  textHash: string; // MD5 hash of text + voice for quick lookup
  text: string; // Original text
  voice: string; // Voice ID used
  audioUrl: string; // Cloudinary URL
  duration?: number; // Audio duration in seconds
  fileSize?: number; // File size in bytes
  hitCount: number; // Number of times this cache entry was used
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ttsCacheSchema = new Schema<ITTSCache>(
  {
    textHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 5000, // Limit text length
    },
    voice: {
      type: String,
      required: true,
      default: 'default',
    },
    audioUrl: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    hitCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'tts_cache',
  }
);

// Index for cache lookup
ttsCacheSchema.index({ textHash: 1 }, { unique: true });

// Index for cleanup - find old unused entries
ttsCacheSchema.index({ lastAccessedAt: 1 });

// TTL index - automatically remove entries not accessed in 90 days
ttsCacheSchema.index(
  { lastAccessedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days
);

// Prevent model recompilation in Next.js development
const TTSCacheModel = models.TTSCache || model<ITTSCache>('TTSCache', ttsCacheSchema);
export default TTSCacheModel;


