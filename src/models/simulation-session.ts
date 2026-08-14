// models/simulation-session.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

const SimulationTurnSchema = new Schema(
	{
		turnNumber: {
			type: Number,
			required: true,
		},
		role: {
			type: String,
			enum: ['student', 'ai'],
			required: true,
		},
		text: {
			type: String,
			required: true,
		},
		audioUrl: {
			type: String,
			default: '',
		},
		audioDurationMs: {
			type: Number,
		},
		speechaceResult: {
			type: Schema.Types.Mixed,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ _id: false }
);

const RevealedFindingSchema = new Schema(
	{
		phaseIndex: {
			type: Number,
			required: true,
		},
		label: {
			type: String,
			required: true,
		},
		revealedAt: {
			type: Date,
			required: true,
		},
	},
	{ _id: false }
);

export interface ISimulationSession extends Document {
	_id: Types.ObjectId;
	scenarioId: Types.ObjectId;
	studentId: Types.ObjectId;
	assignedBy: Types.ObjectId;
	status: 'in_progress' | 'completed' | 'abandoned';
	startedAt: Date;
	completedAt?: Date;
	overallGradeResult?: any;
	turns: {
		turnNumber: number;
		role: 'student' | 'ai';
		text: string;
		audioUrl: string;
		audioDurationMs?: number;
		speechaceResult?: any;
		createdAt: Date;
	}[];
	currentPhaseIndex: number;
	briefingComplete: boolean;
	revealedFindings: {
		phaseIndex: number;
		label: string;
		revealedAt: Date;
	}[];
	createdAt: Date;
	updatedAt: Date;
}

const simulationSessionSchema = new Schema<ISimulationSession>(
	{
		scenarioId: {
			type: Schema.Types.ObjectId,
			ref: 'SimulationScenario',
			required: [true, 'Scenario ID is required'],
			index: true,
		},
		studentId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Student ID is required'],
			index: true,
		},
		assignedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Assigned by user ID is required'],
		},
		status: {
			type: String,
			enum: ['in_progress', 'completed', 'abandoned'],
			default: 'in_progress',
			index: true,
		},
		startedAt: {
			type: Date,
			required: true,
			default: Date.now,
		},
		completedAt: {
			type: Date,
		},
		overallGradeResult: {
			type: Schema.Types.Mixed,
		},
		turns: {
			type: [SimulationTurnSchema],
			default: [],
		},
		currentPhaseIndex: {
			type: Number,
			required: true,
			default: 0,
		},
		briefingComplete: {
			type: Boolean,
			required: true,
			default: false,
		},
		revealedFindings: {
			type: [RevealedFindingSchema],
			default: [],
		},
	},
	{ timestamps: true }
);

// No TTL index: completed sessions must remain queryable indefinitely for grading/audit.

const SimulationSession =
	models.SimulationSession ||
	model<ISimulationSession>('SimulationSession', simulationSessionSchema);

export default SimulationSession;
