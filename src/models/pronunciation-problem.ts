// models/pronunciation-problem.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IPronunciationProblem extends Document {
	_id: Types.ObjectId;
	title: string;
	slug: string; // URL-friendly identifier (unique)
	description?: string;
	phonemes: string[]; // Target phonemes for this problem (e.g., ["r", "l"])
	type: 'word' | 'sound' | 'sentence'; // Required: primary type for this problem (words inherit this type)
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	estimatedTimeMinutes?: number;
	createdBy: Types.ObjectId; // Admin who created it
	isActive: boolean;
	order: number; // Display order
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const pronunciationProblemSchema = new Schema<IPronunciationProblem>(
	{
		title: {
			type: String,
			required: [true, 'Title is required'],
			trim: true,
			maxlength: [200, 'Title cannot exceed 200 characters'],
		},
		slug: {
			type: String,
			required: [true, 'Slug is required'],
			unique: true,
			trim: true,
			lowercase: true,
			match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-friendly'],
		},
		description: {
			type: String,
			trim: true,
			maxlength: [1000, 'Description cannot exceed 1000 characters'],
		},
		phonemes: {
			type: [String],
			required: [true, 'At least one phoneme is required'],
			validate: {
				validator: (v: string[]) => v.length > 0,
				message: 'At least one phoneme is required',
			},
		},
		type: {
			type: String,
			enum: ['word', 'sound', 'sentence'],
			required: [true, 'Type is required'], // Required: words inherit this type
			index: true,
		},
		difficulty: {
			type: String,
			enum: ['beginner', 'intermediate', 'advanced'],
			required: [true, 'Difficulty level is required'],
			default: 'intermediate',
		},
		estimatedTimeMinutes: {
			type: Number,
			min: [1, 'Estimated time must be at least 1 minute'],
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
		order: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
		collection: 'pronunciation_problems',
	}
);

// Indexes for performance
// Note: slug index is automatically created by unique: true on the field
pronunciationProblemSchema.index({ createdBy: 1, createdAt: -1 });
pronunciationProblemSchema.index({ difficulty: 1, isActive: 1 });
pronunciationProblemSchema.index({ type: 1, isActive: 1 }); // Index for type filtering
pronunciationProblemSchema.index({ order: 1, isActive: 1 });
pronunciationProblemSchema.index({ phonemes: 1 });

// Generate slug from title before saving
pronunciationProblemSchema.pre('save', async function () {
	if (this.isModified('title') && !this.slug) {
		this.slug = this.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}
});

export default models?.PronunciationProblem || model<IPronunciationProblem>('PronunciationProblem', pronunciationProblemSchema);

