// Direct frontend SpeechAce API client (no backend proxying)
// This makes direct API calls from the browser to reduce latency

export interface PhoneScore {
	phone: string;
	stress_level: number | null;
	extent: [number, number];
	quality_score: number;
	stress_score?: number;
	predicted_stress_level?: number;
	word_extent: [number, number];
	sound_most_like: string;
}

export interface SyllableScore {
	phone_count: number;
	stress_level: number;
	letters: string;
	quality_score: number;
	stress_score: number;
	predicted_stress_level: number;
	extent: [number, number];
}

export interface WordScore {
	word: string;
	quality_score: number;
	phone_score_list: PhoneScore[];
	syllable_score_list: SyllableScore[];
}

export interface TextScore {
	text: string;
	word_score_list: WordScore[];
	ielts_score: { pronunciation: number };
	pte_score: { pronunciation: number };
	speechace_score: { pronunciation: number };
	toeic_score: { pronunciation: number };
	cefr_score: { pronunciation: string };
}

export interface SpeechaceResponse {
	text: string;
	textScore: TextScore;
}

/**
 * Direct SpeechAce API client for frontend use
 * Makes direct API calls to reduce latency
 */
export class SpeechAceDirectService {
	private readonly apiKey: string;
	private readonly apiEndpoint: string;

	constructor() {
		// Get API key from environment variable (must be exposed to client)
		// In production, consider using a proxy or server-side API key management
		this.apiKey = process.env.NEXT_PUBLIC_SPEECHACE_API_KEY || 
			decodeURIComponent('WkctOEzrFouPkyYcp91FO%2Ft3rfbidCLLVnBqlm%2FpCsZQ2mGJsNUgehSikMOPL%2FkUz0gWpbzK8jNHgn8TTZkRzNKhUQzZG9%2BCCUwuiOO%2Bt84j8mHgiBa%2BJPr1Id4bZnMm');
		this.apiEndpoint = process.env.NEXT_PUBLIC_SPEECHACE_API_ENDPOINT || 'https://api.speechace.co';
	}

	/**
	 * Score pronunciation using Speechace API directly from frontend
	 * @param text The text that was spoken
	 * @param audioBlob The recorded audio as a Blob
	 * @param userId User identifier
	 * @param questionInfo Optional question information
	 * @returns Pronunciation score and detailed feedback
	 */
	async scorePronunciation(
		text: string,
		audioBlob: Blob,
		userId: string,
		questionInfo?: string
	): Promise<SpeechaceResponse> {
		// Convert blob to base64
		const audioBase64 = await this.blobToBase64(audioBlob);

		// Create FormData
		const formData = new FormData();
		formData.append('text', text);
		
		// Convert base64 to blob for FormData
		const audioBuffer = await fetch(`data:audio/webm;base64,${audioBase64}`).then(r => r.blob());
		formData.append('user_audio_file', audioBuffer, 'audio.webm');

		if (questionInfo) {
			formData.append('question_info', questionInfo);
		}

		// Make direct API call to SpeechAce
		const response = await fetch(
			`${this.apiEndpoint}/api/scoring/text/v9/json?key=${encodeURIComponent(this.apiKey)}&dialect=en-us&user_id=${encodeURIComponent(userId)}`,
			{
				method: 'POST',
				body: formData,
				// Don't set Content-Type header - browser will set it with boundary for FormData
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = 'Failed to score pronunciation';
			try {
				const error = JSON.parse(errorText);
				errorMessage = error.message || errorMessage;
			} catch {
				errorMessage = response.statusText || errorMessage;
			}
			throw new Error(errorMessage);
		}

		const data = await response.json();
		return data;
	}

	/**
	 * Convert Blob to base64 string
	 */
	private blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const base64String = reader.result as string;
				// Remove data URL prefix if present
				const base64 = base64String.includes(',')
					? base64String.split(',')[1]
					: base64String;
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}
}

export const speechAceDirectService = new SpeechAceDirectService();

