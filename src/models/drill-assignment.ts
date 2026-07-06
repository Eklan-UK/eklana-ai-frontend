// models/drill-assignment.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User and Drill models so populate() can resolve refs
import '@/models/user';
import '@/models/drill';

export interface IDrillAssignment extends Document {
	_id: Types.ObjectId;
	drillId: Types.ObjectId; // Reference to Drill
	// Reference to User (kept as learnerId for backward compatibility).
	// Better Auth (web sign-up, incl. Google/Apple OAuth) assigns UUID string
	// user ids; legacy/mobile accounts use ObjectId. Stored as Mixed so both
	// formats can be written and queried without a cast error.
	learnerId: Types.ObjectId | string;
	// Admin/Tutor who assigned. Mixed for the same reason as learnerId: Better
	// Auth's UUID generateId applies to every role, so admin/tutor accounts
	// can also have a UUID _id.
	assignedBy: Types.ObjectId | string;
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
			// Removed index: true - covered by compound index { drillId: 1, learnerId: 1 }
		},
		learnerId: {
			// Mixed (not ObjectId) so UUID user ids (Better Auth web sign-up,
			// incl. Google/Apple OAuth) can be stored alongside legacy
			// ObjectId user ids without a Mongoose cast error. No `ref` since
			// Mongoose populate cannot reliably resolve a mixed-type field;
			// see AssignmentRepository.findByDrillId for the manual lookup.
			type: Schema.Types.Mixed,
			required: [true, 'User ID is required'],
			// Removed index: true - covered by compound index { learnerId: 1, status: 1, dueDate: 1 }
		},
		assignedBy: {
			// Mixed: admin/tutor accounts are also Better Auth users and can
			// have a UUID _id, same as learners.
			type: Schema.Types.Mixed,
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

