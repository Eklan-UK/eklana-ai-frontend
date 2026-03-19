interface TTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

// In-memory cache for audio URLs and fetched blobs to avoid repeated network requests.
const sessionUrlCache = new Map<string, string>();
const sessionBlobCache = new Map<string, Blob>();

/**
 * Check if TTS audio is cached on server
 */
async function checkCache(text: string, voice: string = 'default'): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/v1/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`,
      { method: 'GET', credentials: 'include' }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.data?.cached && data.data?.audioUrl) {
        return data.data.audioUrl;
      }
    }
  } catch (error) {
    console.warn('Cache check failed:', error);
  }
  return null;
}

/**
 * Generate TTS with caching - checks server cache first
 * Returns a Blob that can be used to create an audio object URL
 */
async function generateTTSWithCache(options: TTSOptions): Promise<Blob> {
  const cacheKey = `${options.text}:${options.voiceId || 'default'}`;
  
  // Blob cache first (avoids any network call for same-session replay)
  const sessionBlob = sessionBlobCache.get(cacheKey);
  if (sessionBlob) {
    return sessionBlob;
  }

  // URL cache second
  const sessionCachedUrl = sessionUrlCache.get(cacheKey);
  if (sessionCachedUrl) {
    const response = await fetch(sessionCachedUrl);
    if (response.ok) {
      const blob = await response.blob();
      sessionBlobCache.set(cacheKey, blob);
      return blob;
    }
    sessionUrlCache.delete(cacheKey);
  }
  
  // Check server cache
  const cachedUrl = await checkCache(options.text, options.voiceId);
  if (cachedUrl) {
    sessionUrlCache.set(cacheKey, cachedUrl);
    const response = await fetch(cachedUrl);
    if (response.ok) {
      const blob = await response.blob();
      sessionBlobCache.set(cacheKey, blob);
      return blob;
    }
  }
  
  // No cache hit - use backend TTS endpoint which will generate and cache
  const response = await fetch('/api/v1/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      text: options.text,
      voice: options.voiceId || 'default',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Backend TTS failed');
  }
  
  const contentType = response.headers.get('content-type');
  
  // If response is JSON, it contains the cached URL
  if (contentType?.includes('application/json')) {
    const data = await response.json();
    if (data.data?.audioUrl) {
      sessionUrlCache.set(cacheKey, data.data.audioUrl);
      const audioResponse = await fetch(data.data.audioUrl);
      if (audioResponse.ok) {
        const blob = await audioResponse.blob();
        sessionBlobCache.set(cacheKey, blob);
        return blob;
      }
    }
    throw new Error('No audio URL in response');
  }
  
  // Direct audio response
  const blob = await response.blob();
  sessionBlobCache.set(cacheKey, blob);
  return blob;
}

/**
 * Generate TTS audio from text
 * Uses caching layer first, then falls back to direct ElevenLabs API
 * Returns a Blob that can be used to create an audio object URL
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
