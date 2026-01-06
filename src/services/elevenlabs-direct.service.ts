// Direct frontend ElevenLabs API client (no backend proxying)
// This makes direct API calls from the browser to reduce latency

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
 * Direct ElevenLabs API client for frontend use
 * Makes direct API calls to reduce latency
 * 
 * Note: API key must be exposed via NEXT_PUBLIC_ELEVEN_LABS_API_KEY
 * For production, consider using a serverless function or edge function
 * that doesn't add significant latency
 */
export class ElevenLabsDirectService {
	private readonly apiKey: string;
	private readonly apiEndpoint: string;

	constructor() {
		this.apiKey = process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY || '';
		this.apiEndpoint = 'https://api.elevenlabs.io';
	}

	/**
	 * Generate TTS audio directly from frontend
	 * @param options TTS generation options
	 * @returns Audio blob
	 */
	async generateTTS(options: TTSOptions): Promise<Blob> {
		if (!this.apiKey) {
			throw new Error('ElevenLabs API key not configured. Please set NEXT_PUBLIC_ELEVEN_LABS_API_KEY');
		}

		const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM';
		const response = await fetch(`${this.apiEndpoint}/v1/text-to-speech/${voiceId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'xi-api-key': this.apiKey,
			},
			body: JSON.stringify({
				text: options.text,
				model_id: options.modelId || 'eleven_multilingual_v2',
				voice_settings: {
					stability: options.stability ?? 0.5,
					similarity_boost: options.similarityBoost ?? 0.75,
					style: options.style ?? 0.0,
					use_speaker_boost: options.useSpeakerBoost !== undefined ? options.useSpeakerBoost : true,
				},
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = 'Failed to generate audio';
			try {
				const error = JSON.parse(errorText);
				errorMessage = error.detail?.message || error.message || errorMessage;
			} catch {
				errorMessage = response.statusText || errorMessage;
			}
			throw new Error(errorMessage);
		}

		const audioBlob = await response.blob();
		return audioBlob;
	}

	/**
	 * Get available voices
	 */
	async getVoices() {
		if (!this.apiKey) {
			throw new Error('ElevenLabs API key not configured');
		}

		const response = await fetch(`${this.apiEndpoint}/v1/voices`, {
			headers: {
				'xi-api-key': this.apiKey,
			},
		});

		if (!response.ok) {
			throw new Error('Failed to fetch voices');
		}

		const data = await response.json();
		return data.voices || [];
	}
}

export const elevenLabsDirectService = new ElevenLabsDirectService();

