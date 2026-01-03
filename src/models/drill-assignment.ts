// models/drill-assignment.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';

export interface IDrillAssignment extends Document {
	_id: Types.ObjectId;
	drillId: Types.ObjectId; // Reference to Drill
	learnerId: Types.ObjectId; // Reference to Learner (not email!)
	assignedBy: Types.ObjectId; // Admin/Tutor who assigned
	assignedAt: Date;
	dueDate?: Date;
	status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
	completedAt?: Date;
	// Metadata
	createdAt: Date;
	updatedAt: Date;
}

const drillAssignmentSchema = new Schema<IDrillAssignment>(
	{
		drillId: {
			type: Schema.Types.ObjectId,
			ref: 'Drill',
			required: [true, 'Drill ID is required'],
			index: true,
		},
		learnerId: {
			type: Schema.Types.ObjectId,
			ref: 'Learner',
			required: [true, 'Learner ID is required'],
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
	},
	{
		timestamps: true,
		collection: 'drill_assignments',
	}
);

// Indexes for performance
// Unique compound index - prevent duplicate assignments
drillAssignmentSchema.index({ drillId: 1, learnerId: 1 }, { unique: true });

// Get learner's active drills
drillAssignmentSchema.index({ learnerId: 1, status: 1, dueDate: 1 });

// Admin's assignment history
drillAssignmentSchema.index({ assignedBy: 1, assignedAt: -1 });

// Get all assignments for a drill
drillAssignmentSchema.index({ drillId: 1, status: 1 });

// Virtual for checking if assignment is overdue
drillAssignmentSchema.virtual('isOverdue').get(function () {
	if (!this.dueDate || this.status === 'completed' || this.status === 'skipped') {
		return false;
	}
	const now = new Date();
	const due = new Date(this.dueDate);
	return now > due;
});

// Pre-save middleware to update status if overdue
drillAssignmentSchema.pre('save', function () {
	if (this.dueDate && new Date() > this.dueDate && this.status === 'pending') {
		this.status = 'overdue';
	}
});

// Prevent model recompilation in Next.js development
const DrillAssignmentModel = models.DrillAssignment || model<IDrillAssignment>('DrillAssignment', drillAssignmentSchema);
export default DrillAssignmentModel;

