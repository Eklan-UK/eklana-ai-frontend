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

export const DEFAULT_TTS_VOICE_ID =
  process.env.ELEVEN_LABS_DEFAULT_VOICE_ID ||
  process.env.ELEVENLABS_DEFAULT_VOICE_ID ||
  '21m00Tcm4TlvDq8ikWAM';

export function resolveElevenLabsApiKey(): string {
  return (
    config.ELEVEN_LABS_API_KEY ||
    process.env.ELEVEN_LABS_API_KEY ||
    process.env.ELEVENLABS_API_KEY ||
    ''
  );
}

export function resolveVoiceId(inputVoice?: string): string {
  if (!inputVoice || inputVoice === 'default') {
    return DEFAULT_TTS_VOICE_ID;
  }
  return inputVoice;
}

