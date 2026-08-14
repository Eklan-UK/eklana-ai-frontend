// models/simulation-scenario.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

interface IConversationBeat {
	character: string;
	intent: string;
	triggerCondition: string;
}

interface IGatedFinding {
	label: string;
	data: string;
	revealCondition: string;
}

interface IScenarioPhase {
	phaseName: string;
	triggerCondition: string;
	characters: string[];
	conversationBeats: IConversationBeat[];
	gatedFindings: IGatedFinding[];
}

export interface ISimulationScenario extends Document {
	_id: Types.ObjectId;
	title: string;
	workplaceSetting: string;
	dramatisationPrompt: string;
	studentCharacterName: string;
	weeklyFocus: string[];
	displayData: string;
	briefingAudioBase64: string;
	hiddenContext?: any;
	rawSourceText?: string;
	gradingRubric: string;
	maxDurationMinutes: number;
	studentHint: string;
	scenarioScript: IScenarioPhase[];
	assignedLearnerIds: Types.ObjectId[];
	isActive: boolean;
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const ConversationBeatSchema = new Schema(
	{
		character: { type: String, required: true },
		intent: { type: String, required: true },
		triggerCondition: { type: String, required: true },
	},
	{ _id: false }
);

const GatedFindingSchema = new Schema(
	{
		label: { type: String, required: true },
		data: { type: String, required: true },
		revealCondition: { type: String, required: true },
	},
	{ _id: false }
);

const PhaseSchema = new Schema(
	{
		phaseName: { type: String, required: true },
		triggerCondition: { type: String, required: true },
		characters: {
			type: [String],
			required: true,
			default: [],
		},
		conversationBeats: {
			type: [ConversationBeatSchema],
			default: [],
		},
		gatedFindings: {
			type: [GatedFindingSchema],
			default: [],
		},
	},
	{ _id: false }
);

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
		studentCharacterName: {
			type: String,
			required: [true, 'Student character name is required'],
		},
		weeklyFocus: {
			type: [String],
			required: true,
			default: [],
		},
		displayData: {
			type: String,
			required: [true, 'Display data is required'],
		},
		briefingAudioBase64: {
			type: String,
			required: [true, 'Briefing audio is required'],
		},
		hiddenContext: {
			type: Schema.Types.Mixed,
		},
		rawSourceText: {
			type: String,
		},
		gradingRubric: {
			type: String,
			required: [true, 'Grading rubric is required'],
		},
		maxDurationMinutes: {
			type: Number,
			required: true,
			default: 15,
		},
		studentHint: {
			type: String,
			default: '',
		},
		scenarioScript: {
			type: [PhaseSchema],
			default: [],
		},
		assignedLearnerIds: {
			type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
			required: true,
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
