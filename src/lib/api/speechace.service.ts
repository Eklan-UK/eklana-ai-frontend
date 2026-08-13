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

/** Structured SpeechAce API error (e.g. error_no_speech) — do not collapse to opaque 500. */
export class SpeechaceApiError extends Error {
	readonly code: string;
	readonly short_message: string;
	readonly detail_message: string;
	readonly httpStatus: number;

	constructor(
		short_message: string,
		detail_message?: string,
		httpStatus = 422,
		code?: string
	) {
		const detail = detail_message || short_message || 'Speechace API returned an error';
		super(detail);
		this.name = 'SpeechaceApiError';
		this.short_message = short_message || 'SpeechaceError';
		this.detail_message = detail;
		this.code = code || this.short_message;
		this.httpStatus = httpStatus;
	}
}

/** Client audio exceeds the 5 MB scoring limit. */
export class SpeechaceAudioTooLargeError extends Error {
	readonly code = 'AudioTooLarge';
	readonly httpStatus = 413;

	constructor(
		message = 'Audio file is too large to score (max 5 MB). Try a shorter recording.'
	) {
		super(message);
		this.name = 'SpeechaceAudioTooLargeError';
	}
}

export function isSpeechaceApiError(error: unknown): error is SpeechaceApiError {
	if (error instanceof SpeechaceApiError) return true;
	return error instanceof Error && error.name === 'SpeechaceApiError';
}

export function isSpeechaceAudioTooLargeError(
	error: unknown
): error is SpeechaceAudioTooLargeError {
	if (error instanceof SpeechaceAudioTooLargeError) return true;
	return error instanceof Error && error.name === 'SpeechaceAudioTooLargeError';
}

/** Map MIME type to a sensible filename for SpeechAce multipart upload. */
function filenameForMime(mimeType: string): string {
	const base = mimeType.split(';')[0].trim().toLowerCase();
	switch (base) {
		case 'audio/m4a':
		case 'audio/x-m4a':
		case 'audio/mp4':
		case 'audio/aac':
			return 'audio.m4a';
		case 'audio/mpeg':
		case 'audio/mp3':
			return 'audio.mp3';
		case 'audio/wav':
		case 'audio/wave':
		case 'audio/x-wav':
			return 'audio.wav';
		case 'audio/ogg':
		case 'audio/opus':
			return 'audio.ogg';
		case 'audio/webm':
		default:
			return 'audio.webm';
	}
}

/**
 * Sniff common audio container magic bytes when the client omits mimeType.
 * Mobile AAC/m4a often arrives without a data-URL prefix.
 */
function sniffAudioMime(buffer: Buffer): string | null {
	if (buffer.length < 12) return null;

	// WebM / Matroska: 1A 45 DF A3
	if (
		buffer[0] === 0x1a &&
		buffer[1] === 0x45 &&
		buffer[2] === 0xdf &&
		buffer[3] === 0xa3
	) {
		return 'audio/webm';
	}

	// Ogg: "OggS"
	if (
		buffer[0] === 0x4f &&
		buffer[1] === 0x67 &&
		buffer[2] === 0x67 &&
		buffer[3] === 0x53
	) {
		return 'audio/ogg';
	}

	// WAV: "RIFF....WAVE"
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x41 &&
		buffer[10] === 0x56 &&
		buffer[11] === 0x45
	) {
		return 'audio/wav';
	}

	// MP4 / M4A: ....ftyp
	if (
		buffer[4] === 0x66 &&
		buffer[5] === 0x74 &&
		buffer[6] === 0x79 &&
		buffer[7] === 0x70
	) {
		const brand = buffer.slice(8, 12).toString('ascii');
		if (
			brand.startsWith('M4A') ||
			brand === 'mp42' ||
			brand === 'isom' ||
			brand === 'iso2' ||
			brand === 'mp41'
		) {
			return brand.startsWith('M4A') ? 'audio/m4a' : 'audio/mp4';
		}
		return 'audio/mp4';
	}

	// ID3-tagged MP3 or MPEG frame sync
	if (
		(buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
		(buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
	) {
		return 'audio/mpeg';
	}

	return null;
}

function resolveAudioMime(
	buffer: Buffer,
	clientMimeType?: string
): { mimeType: string; filename: string } {
	const normalized = clientMimeType?.split(';')[0]?.trim().toLowerCase();
	const sniffed = sniffAudioMime(buffer);

	let mimeType = 'audio/webm';
	if (normalized && normalized.startsWith('audio/')) {
		mimeType = normalized;
	} else if (sniffed) {
		mimeType = sniffed;
	}

	return { mimeType, filename: filenameForMime(mimeType) };
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
	 * @param mimeType Optional client-reported MIME (e.g. audio/m4a); otherwise sniffed
	 * @returns Pronunciation score and detailed feedback
	 */
	async scorePronunciation(
		text: string,
		audioBase64: string,
		userId: string,
		questionInfo?: string,
		mimeType?: string
	): Promise<SpeechaceScoreResponse & { text_score: number; word_scores: Array<{ word: string; score: number; phonemes?: Array<{ phoneme: string; score: number }> }> }> {
		try {
			// Convert base64 to buffer and then to Blob for native FormData
			const audioBuffer = Buffer.from(audioBase64, 'base64');

			// Guard: reject oversized payloads before hitting Speechace (120 s at 32 kbps ≈ 480 KB)
			if (audioBuffer.length > 5 * 1024 * 1024) {
				throw new SpeechaceAudioTooLargeError();
			}

			const { mimeType: resolvedMime, filename } = resolveAudioMime(
				audioBuffer,
				mimeType
			);
			const audioBlob = new Blob([audioBuffer], { type: resolvedMime });

			// Use native FormData
			const formData = new FormData();
			formData.append('text', text);
			formData.append('user_audio_file', audioBlob, filename);

			if (questionInfo) {
				formData.append('question_info', questionInfo);
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 second timeout (upload + Speechace processing for up to 2 min audio)

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
			// Surface Speechace API errors as structured exceptions (mobile maps error_no_speech)
			if (rawData.status === 'error') {
				const short =
					typeof rawData.short_message === 'string'
						? rawData.short_message
						: 'SpeechaceError';
				const detail =
					typeof rawData.detail_message === 'string'
						? rawData.detail_message
						: short;
				throw new SpeechaceApiError(short, detail, 422, short);
			}

			// Extract the score from the response
			// The API returns text_score (snake_case) object with speechace_score.pronunciation
			// The API response has text_score (snake_case), not textScore (camelCase)
			const textScoreObj = rawData.text_score || rawData.textScore;
			// Use nullish coalescing (??) so a genuine score of 0 is preserved and does not
			// fall through to rawData.text_score (which is the full TextScore object).
			const pronunciationScore = textScoreObj?.speechace_score?.pronunciation ??
			                          (typeof textScoreObj === 'number' ? textScoreObj : 0);

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
				mimeType: resolvedMime,
			});

			return normalizedResponse;
		} catch (error: any) {
			if (isSpeechaceApiError(error) || isSpeechaceAudioTooLargeError(error)) {
				logger.error('Speechace API error', {
					error: error.message,
					code: error.code,
					short_message: (error as SpeechaceApiError).short_message,
				});
				throw error;
			}

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
