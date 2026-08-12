// models/simulation-scenario.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface ISimulationScenario extends Document {
	_id: Types.ObjectId;
	title: string;
	workplaceSetting: string;
	dramatisationPrompt: string;
	weeklyFocus: string[];
	displayData: any;
	hiddenContext?: any;
	rawSourceText?: string;
	gradingRubric?: any;
	allLearners: boolean;
	assignedLearnerIds: Types.ObjectId[];
	isActive: boolean;
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const simulationScenarioSchema = new Schema<ISimulationScenario>(
	{
		title: {
			type: String,
			required: [true, 'Title is required'],
			trim: true,
		},
		workplaceSetting: {
			type: String,
			required: [true, 'Workplace setting is required'],
		},
		dramatisationPrompt: {
			type: String,
			required: [true, 'Dramatisation prompt is required'],
		},
		weeklyFocus: {
			type: [String],
			required: true,
			default: [],
		},
		displayData: {
			type: Schema.Types.Mixed,
			required: [true, 'Display data is required'],
		},
		hiddenContext: {
			type: Schema.Types.Mixed,
		},
		rawSourceText: {
			type: String,
		},
		gradingRubric: {
			type: Schema.Types.Mixed,
		},
		allLearners: {
			type: Boolean,
			default: false,
		},
		assignedLearnerIds: {
			type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
			default: [],
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Created by user ID is required'],
		},
	},
	{ timestamps: true }
);

// isActive is an explicit status field, not a TTL index: scenarios must remain
// queryable after their active window for reporting/audit, unlike
// free-talk-scenario's TTL-deleted documents.

const SimulationScenario =
	models.SimulationScenario ||
	model<ISimulationScenario>('SimulationScenario', simulationScenarioSchema);

export default SimulationScenario;
