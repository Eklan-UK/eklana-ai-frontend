// models/pronunciation-word.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IPronunciationWord extends Document {
	_id: Types.ObjectId;
	word: string; // The word to practice
	ipa: string; // IPA transcription (e.g., "/ˈrɪəli/")
	phonemes: string[]; // Phonemes in this word
	problemId: Types.ObjectId; // Reference to PronunciationProblem
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
pronunciationWordSchema.index({ createdBy: 1, createdAt: -1 });
pronunciationWordSchema.index({ phonemes: 1 });
pronunciationWordSchema.index({ word: 'text' }); // Text search index

export default models?.PronunciationWord || model<IPronunciationWord>('PronunciationWord', pronunciationWordSchema);

