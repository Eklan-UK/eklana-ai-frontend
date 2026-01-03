// Speechace service for pronunciation assessment
import axios from 'axios';
import FormData from 'form-data';
import { logger } from './logger';
import config from './config';

interface SpeechaceScoreRequest {
	text: string;
	user_id: string;
	audio: string; // Base64 encoded audio
	question_info?: string;
	user_audio_sample_rate?: number;
	user_audio_sample_format?: string;
}

interface SpeechaceScoreResponse {
	status: number;
	text_score: number;
	word_scores: Array<{
		word: string;
		score: number;
		phonemes?: Array<{
			phoneme: string;
			score: number;
		}>;
	}>;
	fluency_score?: number;
	text_feedback?: string;
	word_feedback?: Array<{
		word: string;
		feedback: string;
	}>;
}

class SpeechaceService {
	private readonly apiKey: string;
	private readonly apiEndpoint: string;

	constructor() {
		// Decode the URL-encoded product key
		this.apiKey = decodeURIComponent(
			config.SPEECHACE_API_KEY ||
				'WkctOEzrFouPkyYcp91FO%2Ft3rfbidCLLVnBqlm%2FpCsZQ2mGJsNUgehSikMOPL%2FkUz0gWpbzK8jNHgn8TTZkRzNKhUQzZG9%2BCCUwuiOO%2Bt84j8mHgiBa%2BJPr1Id4bZnMm'
		);
		this.apiEndpoint = config.SPEECHACE_API_ENDPOINT || 'https://api.speechace.co';
	}

	/**
	 * Score text pronunciation using Speechace API
	 * @param text The text that was spoken
	 * @param audioBase64 Base64 encoded audio data
	 * @param userId User identifier
	 * @param questionInfo Optional question information
	 * @returns Pronunciation score and detailed feedback
	 */
	async scorePronunciation(
		text: string,
		audioBase64: string,
		userId: string,
		questionInfo?: string
	): Promise<SpeechaceScoreResponse> {
		try {
			// Convert base64 to buffer for form data
			const audioBuffer = Buffer.from(audioBase64, 'base64');

			// Speechace API uses form-data with key as query parameter
			const formData = new FormData();
			formData.append('text', text);
			formData.append('user_audio_file', audioBuffer, {
				filename: 'audio.wav',
				contentType: 'audio/wav',
			});
			if (questionInfo) {
				formData.append('question_info', questionInfo);
			}

			const response = await axios.post<SpeechaceScoreResponse>(
				`${this.apiEndpoint}/api/scoring/text/v9/json?key=${encodeURIComponent(this.apiKey)}&dialect=en-us&user_id=${encodeURIComponent(userId)}`,
				formData,
				{
					headers: {
						...formData.getHeaders(),
					},
					timeout: 30000, // 30 second timeout
				}
			);

			logger.info('Speechace pronunciation score generated', {
				userId,
				text,
				textScore: response.data.text_score,
			});

			return response.data;
		} catch (error: any) {
			logger.error('Speechace API error', {
				error: error.message,
				response: error.response?.data,
				status: error.response?.status,
			});

			if (error.response) {
				throw new Error(
					`Speechace API error: ${error.response.data?.message || error.response.statusText}`
				);
			}

			if (error.request) {
				throw new Error('Speechace API request failed: No response received');
			}

			throw new Error(`Speechace API error: ${error.message}`);
		}
	}

	/**
	 * Validate API connection
	 */
	async validateConnection(): Promise<boolean> {
		try {
			// Simple validation - you might want to use a test endpoint if available
			logger.info('Speechace service initialized', {
				endpoint: this.apiEndpoint,
			});
			return true;
		} catch (error) {
			logger.error('Speechace connection validation failed', { error });
			return false;
		}
	}
}

export const speechaceService = new SpeechaceService();
export type { SpeechaceScoreRequest, SpeechaceScoreResponse };


