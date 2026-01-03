// Use relative path for Next.js API routes
const API_BASE_URL = '/api/v1';

// Speechace API Response Types
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
	code: string;
	message: string;
	data: {
		status: string;
		quota_remaining: number;
		text_score: TextScore;
		version: string;
		request_id: string;
	};
}

/**
 * Speechace service for pronunciation assessment
 */
export const speechaceService = {
	/**
	 * Score pronunciation using Speechace API
	 * @param text The text that was spoken
	 * @param audioBlob The recorded audio as a Blob
	 * @param questionInfo Optional question information
	 * @returns Pronunciation score and detailed feedback
	 */
	scorePronunciation: async (
		text: string,
		audioBlob: Blob,
		questionInfo?: string
	): Promise<SpeechaceResponse> => {
		// Convert blob to base64
		const audioBase64 = await blobToBase64(audioBlob);

		const response = await fetch(`${API_BASE_URL}/speechace/score`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				text,
				audioBase64,
				questionInfo,
			}),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({
				message: 'Failed to score pronunciation',
			}));
			throw new Error(error.message || 'Failed to score pronunciation');
		}

		return await response.json();
	},
};

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
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

