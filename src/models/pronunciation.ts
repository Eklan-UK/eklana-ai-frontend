// models/pronunciation.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IPronunciation extends Document {
	_id: Types.ObjectId;
	title: string;
	description?: string;
	text: string; // The text/phrase to practice
	phonetic?: string; // Phonetic transcription (e.g., /'ri:.əl.i/)
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	audioUrl?: string; // URL to the uploaded audio file (Cloudinary) - OPTIONAL
	audioFileName?: string; // Original filename
	audioDuration?: number; // Duration in seconds
	useTTS: boolean; // If true, use TTS when audioUrl is not provided
	createdBy: Types.ObjectId; // Admin who created it
	isActive: boolean;
	tags?: string[]; // e.g., ['r-l-sound', 'th-sound', 'vowels']
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const pronunciationSchema = new Schema<IPronunciation>(
	{
		title: {
			type: String,
			required: [true, 'Title is required'],
			trim: true,
			maxlength: [200, 'Title cannot exceed 200 characters'],
		},
		description: {
			type: String,
			trim: true,
			maxlength: [500, 'Description cannot exceed 500 characters'],
		},
		text: {
			type: String,
			required: [true, 'Text to practice is required'],
			trim: true,
			maxlength: [1000, 'Text cannot exceed 1000 characters'],
		},
		phonetic: {
			type: String,
			trim: true,
			maxlength: [200, 'Phonetic transcription cannot exceed 200 characters'],
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
		tags: {
			type: [String],
			default: [],
		},
	},
	{
		timestamps: true,
		collection: 'pronunciations',
	}
);

// Indexes for performance
pronunciationSchema.index({ createdBy: 1, createdAt: -1 });
pronunciationSchema.index({ difficulty: 1, isActive: 1 });
pronunciationSchema.index({ tags: 1 });
pronunciationSchema.index({ text: 'text' }); // Text search index

export default models?.Pronunciation || model<IPronunciation>('Pronunciation', pronunciationSchema);

