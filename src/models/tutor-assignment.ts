// models/tutor-assignment.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface ITutorAssignment extends Document {
	_id: Types.ObjectId;
	learnerId: Types.ObjectId;
	tutorId: Types.ObjectId;
	assignedBy: Types.ObjectId; // Admin who made assignment
	assignedAt: Date;
	endedAt?: Date;
	status: 'active' | 'ended' | 'transferred';
	reason?: string; // Why assignment ended
	notes?: string;

	// Performance metrics during this assignment
	sessionsCompleted: number;
	drillsAssigned: number;
	drillsCompleted: number;
	averageScore: number;

	createdAt: Date;
	updatedAt: Date;
}

const tutorAssignmentSchema = new Schema<ITutorAssignment>(
	{
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
			index: true,
		},
		tutorId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Tutor ID is required'],
			index: true,
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
		endedAt: {
			type: Date,
			default: null,
		},
		status: {
			type: String,
			enum: ['active', 'ended', 'transferred'],
			default: 'active',
			required: true,
		},
		reason: {
			type: String,
			maxlength: 500,
		},
		notes: {
			type: String,
			maxlength: 2000,
		},
		sessionsCompleted: {
			type: Number,
			default: 0,
			min: 0,
		},
		drillsAssigned: {
			type: Number,
			default: 0,
			min: 0,
		},
		drillsCompleted: {
			type: Number,
			default: 0,
			min: 0,
		},
		averageScore: {
			type: Number,
			default: 0,
			min: 0,
			max: 100,
		},
	},
	{
		timestamps: true,
		collection: 'tutor_assignments',
	}
);

// Indexes for performance
// Learner's tutor history
tutorAssignmentSchema.index({ learnerId: 1, status: 1, assignedAt: -1 });

// Tutor's current students
tutorAssignmentSchema.index({ tutorId: 1, status: 1 });

// Admin's assignment history
tutorAssignmentSchema.index({ assignedBy: 1, assignedAt: -1 });

// Virtual for duration
tutorAssignmentSchema.virtual('duration').get(function () {
	if (this.endedAt) {
		return Math.floor((this.endedAt.getTime() - this.assignedAt.getTime()) / (1000 * 60 * 60 * 24)); // days
	}
	return Math.floor((new Date().getTime() - this.assignedAt.getTime()) / (1000 * 60 * 60 * 24)); // days
});

// Method to end assignment
tutorAssignmentSchema.methods.endAssignment = function (reason?: string, notes?: string) {
	this.status = 'ended';
	this.endedAt = new Date();
	if (reason) {
		this.reason = reason;
	}
	if (notes) {
		this.notes = notes;
	}
};

// Prevent model recompilation in Next.js development
const TutorAssignmentModel = models.TutorAssignment || model<ITutorAssignment>('TutorAssignment', tutorAssignmentSchema);
export default TutorAssignmentModel;

