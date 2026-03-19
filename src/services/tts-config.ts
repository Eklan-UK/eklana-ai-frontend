import config from '@/lib/api/config';

export interface TTSVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export const DEFAULT_TTS_MODEL_ID = 'eleven_multilingual_v2';
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

