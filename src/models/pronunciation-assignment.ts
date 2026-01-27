// models/pronunciation-assignment.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IPronunciationAssignment extends Document {
	_id: Types.ObjectId;
	pronunciationId: Types.ObjectId; // Reference to Pronunciation
	learnerId: Types.ObjectId; // Reference to Learner
	assignedBy: Types.ObjectId; // Admin who assigned
	assignedAt: Date;
	dueDate?: Date;
	status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
	completedAt?: Date;
	// Practice tracking
	attemptsCount: number;
	bestScore?: number; // Best pronunciation score achieved
	lastAttemptAt?: Date;
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const pronunciationAssignmentSchema = new Schema<IPronunciationAssignment>(
	{
		pronunciationId: {
			type: Schema.Types.ObjectId,
			ref: 'Pronunciation',
			required: [true, 'Pronunciation ID is required'],
			// Removed index: true - covered by compound index { pronunciationId: 1, learnerId: 1 }
		},
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			// Removed index: true - covered by compound index { learnerId: 1, status: 1, dueDate: 1 }
		},
		assignedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Assigned by user ID is required'],
			index: true,
		},
		assignedAt: {
			type: Date,
			default: Date.now,
			required: true,
		},
		dueDate: {
			type: Date,
			default: null,
		},
		status: {
			type: String,
			enum: ['pending', 'in-progress', 'completed', 'overdue', 'skipped'],
			default: 'pending',
			required: true,
		},
		completedAt: {
			type: Date,
			default: null,
		},
		attemptsCount: {
			type: Number,
			default: 0,
			min: 0,
		},
		bestScore: {
			type: Number,
			default: null,
			min: 0,
			max: 100,
		},
		lastAttemptAt: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: 'pronunciation_assignments',
	}
);

// Indexes for performance
pronunciationAssignmentSchema.index({ pronunciationId: 1, learnerId: 1 }, { unique: true });
pronunciationAssignmentSchema.index({ learnerId: 1, status: 1, dueDate: 1 });
pronunciationAssignmentSchema.index({ assignedBy: 1, assignedAt: -1 });
pronunciationAssignmentSchema.index({ pronunciationId: 1, status: 1 });

// Pre-save middleware to update status if overdue
pronunciationAssignmentSchema.pre('save', function (next) {
	if (this.dueDate && new Date() > this.dueDate && this.status === 'pending') {
		this.status = 'overdue';
	}
	// No need to call next() in async middleware
});

export default models?.PronunciationAssignment || model<IPronunciationAssignment>('PronunciationAssignment', pronunciationAssignmentSchema);

