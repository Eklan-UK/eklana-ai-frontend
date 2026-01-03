// Use relative path for Next.js API routes
const API_BASE_URL = "/api/v1";

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
 * Generate TTS audio from text (streams directly from backend)
 * Returns a Blob that can be used to create an audio object URL
 */
export async function generateTTS(options: TTSOptions): Promise<Blob> {
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

/**
 * Get available voices
 */
export async function getAvailableVoices() {
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
