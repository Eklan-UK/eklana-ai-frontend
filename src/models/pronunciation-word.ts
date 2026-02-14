// models/pronunciation-word.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';
import PronunciationProblem from '@/models/pronunciation-problem';

export interface IPronunciationWord extends Document {
	_id: Types.ObjectId;
	word: string; // The word to practice
	ipa: string; // IPA transcription (e.g., "/ˈrɪəli/")
	phonemes: string[]; // Phonemes in this word
	problemId: Types.ObjectId; // Reference to PronunciationProblem
	type?: 'word' | 'sound' | 'sentence'; // Auto-inherited from problem type (optional in interface, auto-set in schema)
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	audioUrl?: string; // Optional uploaded audio (Cloudinary)
	audioFileName?: string;
	audioDuration?: number; // Duration in seconds
	useTTS: boolean; // Use TTS if no audio file
	order: number; // Order within problem
	createdBy: Types.ObjectId; // Admin who created it
	isActive: boolean;
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const pronunciationWordSchema = new Schema<IPronunciationWord>(
	{
		word: {
			type: String,
			required: [true, 'Word is required'],
			trim: true,
			maxlength: [200, 'Word cannot exceed 200 characters'],
		},
		ipa: {
			type: String,
			required: [true, 'IPA transcription is required'],
			trim: true,
			maxlength: [200, 'IPA cannot exceed 200 characters'],
		},
		phonemes: {
			type: [String],
			required: [true, 'At least one phoneme is required'],
			validate: {
				validator: (v: string[]) => v.length > 0,
				message: 'At least one phoneme is required',
			},
		},
		problemId: {
			type: Schema.Types.ObjectId,
			ref: 'PronunciationProblem',
			required: [true, 'Problem ID is required'],
			index: true,
		},
		type: {
			type: String,
			enum: ['word', 'sound', 'sentence'],
			required: false, // Will be auto-set from problem type
			index: true,
		},
		difficulty: {
			type: String,
			enum: ['beginner', 'intermediate', 'advanced'],
			required: [true, 'Difficulty level is required'],
			default: 'intermediate',
		},
		audioUrl: {
			type: String,
			required: false, // Audio is optional - can use TTS instead
		},
		audioFileName: {
			type: String,
			trim: true,
		},
		audioDuration: {
			type: Number,
			min: [0, 'Duration cannot be negative'],
		},
		useTTS: {
			type: Boolean,
			default: true, // Default to using TTS if no audio file
		},
		order: {
			type: Number,
			default: 0,
			required: true,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Creator is required'],
			index: true,
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
	},
	{
		timestamps: true,
		collection: 'pronunciation_words',
	}
);

// Indexes for performance
pronunciationWordSchema.index({ problemId: 1, order: 1 });
pronunciationWordSchema.index({ problemId: 1, isActive: 1 });
pronunciationWordSchema.index({ problemId: 1, type: 1, isActive: 1 }); // Compound index for filtering by type
pronunciationWordSchema.index({ createdBy: 1, createdAt: -1 });
pronunciationWordSchema.index({ phonemes: 1 });
pronunciationWordSchema.index({ type: 1 }); // Index for type filtering
pronunciationWordSchema.index({ word: 'text' }); // Text search index

// Pre-save hook: Automatically set type from problem
pronunciationWordSchema.pre('save', async function () {
	// Only set type if it's not already set and we have a problemId
	if (!this.type && this.problemId) {
		try {
			const problem = await PronunciationProblem.findById(this.problemId).lean().exec();
			if (problem?.type) {
				this.type = problem.type;
			} else {
				// Fallback to 'word' if problem type is missing
				this.type = 'word';
			}
		} catch (error) {
			// If we can't fetch the problem, fallback to 'word'
			this.type = 'word';
		}
	}
});

export default models?.PronunciationWord || model<IPronunciationWord>('PronunciationWord', pronunciationWordSchema);

