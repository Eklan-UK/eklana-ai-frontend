import { Types } from 'mongoose';

export interface WeaknessSignal {
	drillType: string;
	category: 'pronunciation' | 'fluency' | 'vocabulary' | 'grammar';
	severity: number; // 0–1
	evidence: string[];
	label: string;
}

export interface PronunciationGeneratedContent {
	pronunciation_items: Array<{
		word: string;
		sentence: string;
		sound?: string;
		wordAudioUrl?: string;
		sentenceAudioUrl?: string;
	}>;
}

export interface FillBlankGeneratedContent {
	fill_blank_items: Array<{
		context?: string;
		sentence: string;
		blanks: Array<{
			position: number;
			correctAnswer: string;
			options: string[];
			hint?: string;
		}>;
		translation?: string;
		audioUrl?: string;
	}>;
}

export interface KeyPhrasesGeneratedContent {
	key_phrase_items: Array<{
		prompt: string;
		options: string[];
		correctAnswer: string;
		respondentName?: string;
		promptAudioUrl?: string;
	}>;
}

export interface RoleplayGeneratedContent {
	student_character_name: string;
	ai_character_names: string[];
	context?: string;
	drill_intro?: string;
	roleplay_scenes: Array<{
		scene_name?: string;
		context?: string;
		dialogue: Array<{
			speaker: string;
			text: string;
			translation?: string;
			audioUrl?: string;
		}>;
	}>;
}

export interface WeaknessProfile {
	learnerId: Types.ObjectId;
	weekStartDate: Date;
	weaknesses: WeaknessSignal[];
	topWeaknesses: WeaknessSignal[]; // top 4
	masteredPhonemes?: string[];
	primaryMission?: number | null;
	primaryTopic?: string | null;
	country?: string | null;
	studentName: string;
	studentRole: string;
	generatedAt: Date;
}

export interface ChallengeDrillItem {
	drillType: 'pronunciation' | 'vocabulary' | 'fill_blank' | 'key_phrases' | 'roleplay';
	targetWeakness: WeaknessSignal;
	instructions: string;
	generatedContent:
		| PronunciationGeneratedContent
		| FillBlankGeneratedContent
		| KeyPhrasesGeneratedContent
		| RoleplayGeneratedContent;
	estimatedMinutes: number;
}

export interface WeeklyChallenge {
	learnerId: Types.ObjectId;
	weekStartDate: Date;
	weaknessProfile: WeaknessProfile;
	challengeType: 'structured_drill_sequence';
	content: {
		drillSequence: ChallengeDrillItem[];
		totalEstimatedMinutes: number;
		summaryMessage: string; // e.g. "Tackle Your Weaknesses from Last Week"
	};
	status: 'pending' | 'generating' | 'ready' | 'failed';
	generatedAt?: Date; // only set when status === 'ready'
	createdAt: Date;
}
