// models/drill-assignment.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User and Drill models so populate() can resolve refs
import '@/models/user';
import '@/models/drill';
import { isDrillCompletionOverdue } from '@/lib/drill-completion-date';

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
	/**
	 * AI Drill Builder week slot (1-based). Arrangement-only — used to bucket
	 * assignments in the builder weeks UI. Independent of `assignedAt` so moves
	 * do not affect learner challenge timing or other assignedAt-based features.
	 */
	builderWeekNumber?: number | null;
	/**
	 * Denormalized copy of the owning Drill's `source` (see src/models/drill.ts).
	 * Tag-only — lets shared queries (AI Drill Builder week counting, Home/My
	 * Plans/Learning Journey lists) exclude Precision Clinic assignments
	 * without an extra Drill join. Kept in sync with the Drill by DrillService.
	 */
	source?: 'precision_clinic';
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
		builderWeekNumber: {
			type: Number,
			default: null,
			min: 1,
		},
		source: {
			type: String,
			enum: ['precision_clinic'],
			required: false,
			index: true,
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

// Learner list sorted by assignedAt (my-drills findByLearnerId)
drillAssignmentSchema.index({ learnerId: 1, assignedAt: -1 });

// Drill Builder week bucketing
drillAssignmentSchema.index({ learnerId: 1, builderWeekNumber: 1 });

// Admin's assignment history
drillAssignmentSchema.index({ assignedBy: 1, assignedAt: -1 });

// Get all assignments for a drill
drillAssignmentSchema.index({ drillId: 1, status: 1 });

// Virtual for checking if assignment is overdue
drillAssignmentSchema.virtual('isOverdue').get(function () {
	if (!this.dueDate || this.status === 'completed' || this.status === 'skipped') {
		return false;
	}
	return isDrillCompletionOverdue(this.dueDate);
});

// Pre-save middleware to update status if overdue
drillAssignmentSchema.pre('save', function () {
	if (
		this.dueDate &&
		this.status === 'pending' &&
		isDrillCompletionOverdue(this.dueDate)
	) {
		this.status = 'overdue';
	}
});

// Re-register in dev so schema changes (e.g. builderWeekNumber) apply without
// a full server restart. Without this, Mongoose keeps the first-compiled schema
// and silently strips unknown paths from updates (strict mode).
if (process.env.NODE_ENV === 'development' && models.DrillAssignment) {
	delete models.DrillAssignment;
}

const DrillAssignmentModel =
	models.DrillAssignment ||
	model<IDrillAssignment>('DrillAssignment', drillAssignmentSchema);
export default DrillAssignmentModel;

