// Use direct ElevenLabs API for better performance (no backend proxying)
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

/**
 * Generate TTS audio from text using direct ElevenLabs API
 * Returns a Blob that can be used to create an audio object URL
 * This makes direct frontend API calls to reduce latency
 */
export async function generateTTS(options: TTSOptions): Promise<Blob> {
  try {
    return await elevenLabsDirectService.generateTTS(options);
  } catch (error: any) {
    // Fallback to backend API if direct call fails (e.g., API key not configured)
    console.warn("Direct ElevenLabs call failed, falling back to backend:", error.message);
    
    const API_BASE_URL = "/api/v1";
    const response = await fetch(`${API_BASE_URL}/ai/tts/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for auth
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      // Try to parse error as JSON, fallback to text
      let errorMessage = "Failed to generate audio";
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Response is an audio stream (audio/mpeg)
    const audioBlob = await response.blob();
    return audioBlob;
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
