import { Types } from 'mongoose';

export interface WeaknessSignal {
	drillType: string;
	category: 'pronunciation' | 'fluency' | 'vocabulary' | 'grammar';
	severity: number; // 0–1
	evidence: string[];
	label: string;
}

export interface WeaknessProfile {
	learnerId: Types.ObjectId;
	weekStartDate: Date;
	weaknesses: WeaknessSignal[];
	topWeaknesses: WeaknessSignal[]; // top 3
	generatedAt: Date;
}

export interface ChallengeDrillItem {
	drillType: string; // one of the 12 drill types
	targetWeakness: WeaknessSignal;
	instructions: string; // Gemini-generated instruction for this item
	generatedContent: Record<string, unknown>; // Gemini-generated drill content matching existing drill schemas
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
		summaryMessage: string; // e.g. "This week focus on: fluency, phoneme /θ/, vocabulary"
	};
	status: 'pending' | 'generating' | 'ready' | 'failed';
	generatedAt?: Date; // only set when status === 'ready'
	createdAt: Date;
}
