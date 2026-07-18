interface TTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  /** Override the backend TTS endpoint. Defaults to '/api/v1/tts'. */
  apiPath?: string;
}

export class TTSRequestError extends Error {
  public readonly code?: string;
  public readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'TTSRequestError';
    this.status = status;
    this.code = code;
  }
}

// In-memory blob cache — avoids any network call when the same phrase is replayed in-session.
const sessionBlobCache = new Map<string, Blob>();

async function throwForFailedTTSResponse(response: Response): Promise<never> {
  let message = 'Backend TTS failed';
  let code: string | undefined;
  try {
    const data = (await response.json()) as { code?: string; message?: string };
    if (typeof data.message === 'string' && data.message.trim()) {
      message = data.message;
    }
    if (typeof data.code === 'string' && data.code.trim()) {
      code = data.code;
    }
  } catch {
    // non-JSON body — keep generic message
  }
  throw new TTSRequestError(message, response.status, code);
}

/**
 * Generate TTS with in-session caching.
 * The backend POST endpoint already checks its own server-side cache, so we skip
 * the redundant pre-flight GET that used to add an extra round-trip before every generation.
 */
async function generateTTSWithCache(options: TTSOptions): Promise<Blob> {
  const endpoint = options.apiPath || '/api/v1/tts';
  const cacheKey = `${endpoint}:${options.text}:${options.voiceId || 'default'}`;

  // Return immediately from in-memory blob cache (same-session replay).
  const cached = sessionBlobCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      text: options.text,
      voice: options.voiceId || 'default',
    }),
  });

  if (!response.ok) {
    await throwForFailedTTSResponse(response);
  }

  const contentType = response.headers.get('content-type');

  // Some backend configs return JSON with a CDN/cache URL rather than a direct audio body.
  if (contentType?.includes('application/json')) {
    const data = await response.json();
    if (data.data?.audioUrl) {
      const audioResponse = await fetch(data.data.audioUrl);
      if (audioResponse.ok) {
        const blob = await audioResponse.blob();
        sessionBlobCache.set(cacheKey, blob);
        return blob;
      }
    }
    throw new Error('No audio URL in TTS response');
  }

  // Direct audio body (most common path).
  const blob = await response.blob();
  sessionBlobCache.set(cacheKey, blob);
  return blob;
}

/**
 * Generate TTS audio from text.
 * Uses in-session blob cache for replay; returns a Blob for an object URL.
 */
export async function generateTTS(options: TTSOptions): Promise<Blob> {
  return await generateTTSWithCache(options);
}

/**
 * Get available voices
 * Uses direct ElevenLabs API if available, otherwise falls back to backend
 */
export async function getAvailableVoices() {
  const API_BASE_URL = "/api/v1";
  const response = await fetch(`${API_BASE_URL}/ai/tts/voices`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch voices");
  }

  const data = await response.json();
  return data.data.voices || [];
}

// Note: No longer needed - audio is streamed directly, no file URLs
