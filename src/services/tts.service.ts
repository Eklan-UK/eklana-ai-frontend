// Use direct ElevenLabs API for better performance (no backend proxying)
// With caching layer to minimize API calls
import { elevenLabsDirectService } from "./elevenlabs-direct.service";

interface TTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

// In-memory cache for audio URLs to avoid repeated fetches within same session
const sessionCache = new Map<string, string>();

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
  
  // Check session cache first (in-memory, fastest)
  const sessionCachedUrl = sessionCache.get(cacheKey);
  if (sessionCachedUrl) {
    try {
      const response = await fetch(sessionCachedUrl);
      if (response.ok) {
        return await response.blob();
      }
    } catch (e) {
      // Session cache URL invalid, remove it
      sessionCache.delete(cacheKey);
    }
  }
  
  // Check server cache
  const cachedUrl = await checkCache(options.text, options.voiceId);
  if (cachedUrl) {
    // Save to session cache for faster subsequent access
    sessionCache.set(cacheKey, cachedUrl);
    try {
      const response = await fetch(cachedUrl);
      if (response.ok) {
        return await response.blob();
      }
    } catch (e) {
      console.warn('Failed to fetch cached audio, regenerating:', e);
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
    // If backend caching endpoint fails, fall back to direct ElevenLabs
    throw new Error('Backend TTS failed');
  }
  
  const contentType = response.headers.get('content-type');
  
  // If response is JSON, it contains the cached URL
  if (contentType?.includes('application/json')) {
    const data = await response.json();
    if (data.data?.audioUrl) {
      sessionCache.set(cacheKey, data.data.audioUrl);
      const audioResponse = await fetch(data.data.audioUrl);
      if (audioResponse.ok) {
        return await audioResponse.blob();
      }
    }
    throw new Error('No audio URL in response');
  }
  
  // Direct audio response
  return await response.blob();
}

/**
 * Generate TTS audio from text
 * Uses caching layer first, then falls back to direct ElevenLabs API
 * Returns a Blob that can be used to create an audio object URL
 */
export async function generateTTS(options: TTSOptions): Promise<Blob> {
  try {
    // Try cached/backend approach first (cheaper, faster for repeated content)
    return await generateTTSWithCache(options);
  } catch (cacheError: any) {
    console.warn("Cached TTS failed, trying direct ElevenLabs:", cacheError.message);
    
    try {
      // Fall back to direct ElevenLabs API
      return await elevenLabsDirectService.generateTTS(options);
    } catch (directError: any) {
      // Final fallback to backend API
      console.warn("Direct ElevenLabs call failed, falling back to legacy backend:", directError.message);
      
      const API_BASE_URL = "/api/v1";
      const response = await fetch(`${API_BASE_URL}/ai/tts/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate audio";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.blob();
    }
  }
}

/**
 * Get available voices
 * Uses direct ElevenLabs API if available, otherwise falls back to backend
 */
export async function getAvailableVoices() {
  try {
    return await elevenLabsDirectService.getVoices();
  } catch (error: any) {
    // Fallback to backend API
    console.warn("Direct ElevenLabs call failed, falling back to backend:", error.message);
    
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
}

// Note: No longer needed - audio is streamed directly, no file URLs
