import config from '@/lib/api/config';

export interface TTSVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

/** Sub-second latency; override with ELEVEN_LABS_TTS_MODEL_ID if needed. */
export const DEFAULT_TTS_MODEL_ID =
	process.env.ELEVEN_LABS_TTS_MODEL_ID?.trim() || 'eleven_flash_v2_5';
export const DEFAULT_TTS_VOICE_SETTINGS: TTSVoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

// Falls back to ElevenLabs "Rachel" (21m00Tcm4TlvDq8ikWAM) to prevent crashes when env var is unset.
// Set ELEVEN_LABS_DEFAULT_VOICE_ID in .env to control the AI voice used across the app.
const _envVoiceId = process.env.ELEVEN_LABS_DEFAULT_VOICE_ID?.trim();

if (!_envVoiceId && typeof window === 'undefined') {
  console.warn(
    '[TTS] ELEVEN_LABS_DEFAULT_VOICE_ID is not set — using hardcoded fallback voice. Set it in .env to control the AI voice.'
  );
}

export const DEFAULT_TTS_VOICE_ID = _envVoiceId || '21m00Tcm4TlvDq8ikWAM';

export function resolveElevenLabsApiKey(): string {
  return (
    config.ELEVEN_LABS_API_KEY?.trim() ||
    process.env.ELEVEN_LABS_API_KEY?.trim() ||
    ''
  );
}

// Server-startup diagnostic — surfaces misconfigured keys immediately in logs.
if (typeof window === 'undefined') {
  const _key = resolveElevenLabsApiKey();
  if (!_key) {
    console.warn('[TTS] No ElevenLabs API key found — TTS will not work. Set ELEVEN_LABS_API_KEY in .env');
  } else {
    console.info(`[TTS] ElevenLabs API key loaded (length: ${_key.length})`);
  }
}

export function resolveVoiceId(inputVoice?: string): string {
  if (!inputVoice || inputVoice === 'default') {
    return DEFAULT_TTS_VOICE_ID;
  }
  return inputVoice;
}

