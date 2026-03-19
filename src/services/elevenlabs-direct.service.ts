// Compatibility wrapper. Provider calls are server-only now.

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
 * Backward-compatible API wrapper used by older call sites.
 * Routes requests through authenticated backend endpoints.
 */
export class ElevenLabsDirectService {
	constructor() {}

	/**
	 * Generate TTS audio directly from frontend
	 * @param options TTS generation options
	 * @returns Audio blob
	 */
	async generateTTS(options: TTSOptions): Promise<Blob> {
		const response = await fetch('/api/v1/ai/tts/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
			body: JSON.stringify(options),
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
		const response = await fetch('/api/v1/ai/tts/voices', {
			credentials: 'include',
		});

		if (!response.ok) {
			throw new Error('Failed to fetch voices');
		}
		const data = await response.json();
		return data.data?.voices || [];
	}
}

export const elevenLabsDirectService = new ElevenLabsDirectService();

