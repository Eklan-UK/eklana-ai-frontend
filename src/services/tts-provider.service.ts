import { logger } from '@/lib/api/logger';
import {
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_TTS_VOICE_SETTINGS,
  resolveElevenLabsApiKey,
  resolveVoiceId,
} from '@/services/tts-config';

export interface GenerateProviderTTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ProviderErrorInfo {
  code: string;
  message: string;
  status: number;
}

function parseProviderError(
  status: number,
  statusText: string,
  errorText: string
): ProviderErrorInfo {
  let parsedMessage = errorText || statusText || 'TTS provider request failed';
  try {
    const parsed = JSON.parse(errorText);
    parsedMessage = parsed.detail?.message || parsed.message || parsedMessage;
  } catch {
    // use raw response text
  }

  if (status === 401) {
    return {
      code: 'TTSProviderAuthError',
      message: 'ElevenLabs API key is invalid or expired',
      status,
    };
  }
  if (status === 402) {
    return {
      code: 'TTSProviderPlanError',
      message:
        'ElevenLabs blocked this request for your account plan. Use an owned voice ID or upgrade plan.',
      status,
    };
  }
  if (status === 429) {
    return {
      code: 'TTSProviderRateLimit',
      message: 'ElevenLabs rate limit reached. Please retry shortly.',
      status,
    };
  }
  return {
    code: 'TTSProviderError',
    message: parsedMessage || 'Failed to generate TTS audio',
    status,
  };
}

export class TTSProviderError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(info: ProviderErrorInfo) {
    super(info.message);
    this.code = info.code;
    this.status = info.status;
  }
}

export async function generateElevenLabsAudio(
  options: GenerateProviderTTSOptions
): Promise<ArrayBuffer> {
  const apiKey = resolveElevenLabsApiKey();
  if (!apiKey) {
    throw new TTSProviderError({
      code: 'TTSConfigError',
      message: 'TTS service not configured',
      status: 500,
    });
  }

  const voiceId = resolveVoiceId(options.voiceId);
  const startedAt = Date.now();

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: options.text,
      model_id: options.modelId || DEFAULT_TTS_MODEL_ID,
      voice_settings: {
        stability: options.stability ?? DEFAULT_TTS_VOICE_SETTINGS.stability,
        similarity_boost: options.similarityBoost ?? DEFAULT_TTS_VOICE_SETTINGS.similarity_boost,
        style: options.style ?? DEFAULT_TTS_VOICE_SETTINGS.style,
        use_speaker_boost:
          options.useSpeakerBoost ?? DEFAULT_TTS_VOICE_SETTINGS.use_speaker_boost,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    const errorInfo = parseProviderError(response.status, response.statusText, errorText);
    logger.error('ElevenLabs provider request failed', {
      route: 'tts-provider',
      provider_status: response.status,
      tts_code: errorInfo.code,
      voice_id: voiceId,
      text_len: options.text.length,
      latency_ms: Date.now() - startedAt,
    });
    throw new TTSProviderError(errorInfo);
  }

  const audioBuffer = await response.arrayBuffer();
  logger.info('ElevenLabs provider request succeeded', {
    route: 'tts-provider',
    provider_status: response.status,
    voice_id: voiceId,
    text_len: options.text.length,
    latency_ms: Date.now() - startedAt,
  });
  return audioBuffer;
}

export async function getElevenLabsVoices() {
  const apiKey = resolveElevenLabsApiKey();
  if (!apiKey) {
    throw new TTSProviderError({
      code: 'TTSConfigError',
      message: 'TTS service not configured',
      status: 500,
    });
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    const info = parseProviderError(response.status, response.statusText, text);
    throw new TTSProviderError(info);
  }
  const data = await response.json();
  return data.voices || [];
}

