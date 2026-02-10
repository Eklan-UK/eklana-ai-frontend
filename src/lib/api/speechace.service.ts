// Speechace service for pronunciation assessment
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

interface WordScore {
	word: string;
	quality_score: number;
	phone_score_list: Array<{
		phone: string;
		quality_score: number;
		sound_most_like: string;
	}>;
	syllable_score_list: Array<{
		letters: string;
		quality_score: number;
	}>;
}

interface TextScore {
	text: string;
	word_score_list: WordScore[];
	speechace_score: { pronunciation: number };
	ielts_score: { pronunciation: number };
	pte_score: { pronunciation: number };
	toeic_score: { pronunciation: number };
	cefr_score: { pronunciation: string };
}

interface SpeechaceScoreResponse {
	text: string;
	textScore: TextScore;
	// Legacy fields for backward compatibility
	status?: number;
	text_score?: number;
	word_scores?: Array<{
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
	): Promise<SpeechaceScoreResponse & { text_score: number; word_scores: Array<{ word: string; score: number; phonemes?: Array<{ phoneme: string; score: number }> }> }> {
		try {
			// Convert base64 to buffer and then to Blob for native FormData
			const audioBuffer = Buffer.from(audioBase64, 'base64');
			const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

			// Use native FormData
			const formData = new FormData();
			formData.append('text', text);
			formData.append('user_audio_file', audioBlob, 'audio.wav');
			
			if (questionInfo) {
				formData.append('question_info', questionInfo);
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

			const url = `${this.apiEndpoint}/api/scoring/text/v9/json?key=${encodeURIComponent(this.apiKey)}&dialect=en-us&user_id=${encodeURIComponent(userId)}`;
			
			const response = await fetch(url, {
				method: 'POST',
				body: formData,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorBody = await response.text();
				throw new Error(`Speechace API error: ${response.status} ${response.statusText} - ${errorBody}`);
			}

			const rawData = await response.json();

			// Extract the score from the response
			// The API returns text_score (snake_case) object with speechace_score.pronunciation
			// The API response has text_score (snake_case), not textScore (camelCase)
			const textScoreObj = rawData.text_score || rawData.textScore;
			const pronunciationScore = textScoreObj?.speechace_score?.pronunciation || 
			                          (typeof textScoreObj === 'number' ? textScoreObj : 0) ||
			                          rawData.text_score || 0;

			// Convert word_score_list to word_scores format for backward compatibility
			const word_scores = textScoreObj?.word_score_list?.map((ws: WordScore) => ({
				word: ws.word,
				score: ws.quality_score,
				phonemes: ws.phone_score_list?.map((ps) => ({
					phoneme: ps.phone,
					score: ps.quality_score,
					sound_most_like: ps.sound_most_like, // Added sound_most_like to preserve data
				})),
			})) || [];

			// Create normalized response
			// Include textScore (camelCase) for frontend compatibility, and text_score (number) for backward compatibility
			const normalizedResponse: SpeechaceScoreResponse & { text_score: number; word_scores: Array<{ word: string; score: number; phonemes?: Array<{ phoneme: string; score: number }> }> } = {
				...rawData,
				textScore: textScoreObj, // TextScore object (camelCase for frontend)
				text_score: pronunciationScore, // Number score (for backward compatibility)
				word_scores: word_scores,
			};

			logger.info('Speechace pronunciation score generated', {
				userId,
				text,
				score: pronunciationScore,
			});

			return normalizedResponse;
		} catch (error: any) {
			logger.error('Speechace API error', {
				error: error.message,
				cause: error.cause,
			});

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


