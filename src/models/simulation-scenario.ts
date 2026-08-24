// models/simulation-scenario.model.ts
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

interface IScenarioPhase {
	phaseTitle: string;
	situation: string;
	clinicalInformation: string;
	triggerCondition: string;
	characters: string[];
	dramatisationPrompt: string;
}

interface IScenarioHint {
	phaseTitle: string;
	hintText: string;
}

export interface ISimulationScenario extends Document {
	_id: Types.ObjectId;
	workplaceSetting: string;
	studentCharacterName: string;
	topicId: string;
	weeklyFocus: string[];
	background: string;
	backgroundAudioBase64: string;
	patientInformation: string;
	patientInformationAudioBase64: string;
	hiddenContext?: any;
	rawSourceText?: string;
	gradingRubric: string;
	maxDurationMinutes: number;
	hints: IScenarioHint[];
	scenarioScript: IScenarioPhase[];
	assignedLearnerIds: Types.ObjectId[];
	isActive: boolean;
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const HintSchema = new Schema(
	{
		phaseTitle: { type: String, required: true },
		hintText: { type: String, required: true },
	},
	{ _id: false }
);

const PhaseSchema = new Schema(
	{
		phaseTitle: { type: String, required: true },
		situation: { type: String, required: true },
		clinicalInformation: { type: String, required: true },
		triggerCondition: { type: String, required: true },
		characters: {
			type: [String],
			required: true,
			default: [],
		},
		dramatisationPrompt: { type: String, required: true },
	},
	{ _id: false }
);

const simulationScenarioSchema = new Schema<ISimulationScenario>(
	{
		workplaceSetting: {
			type: String,
			required: [true, 'Workplace setting is required'],
		},
		studentCharacterName: {
			type: String,
			required: [true, 'Student character name is required'],
		},
		// Stored raw (no Mongoose enum) so a change to COMPETENCY_FRAMEWORK's key
		// set never requires a schema migration — validated against the framework
		// at the API boundary instead (see simulation-scenario-api-schema.ts).
		// Topic is also the sole scenario identifier shown to tutors/admins/
		// students now that title has been removed — multiple scenarios may
		// share the same topic with nothing else distinguishing them in the
		// admin list. Known tradeoff, not addressed here.
		topicId: {
			type: String,
			required: [true, 'Topic is required'],
		},
		weeklyFocus: {
			type: [String],
			required: true,
			default: [],
		},
		background: {
			type: String,
			required: [true, 'Background is required'],
		},
		backgroundAudioBase64: {
			type: String,
			required: [true, 'Background audio is required'],
		},
		patientInformation: {
			type: String,
			required: [true, 'Patient information is required'],
		},
		patientInformationAudioBase64: {
			type: String,
			required: [true, 'Patient information audio is required'],
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
		hints: {
			type: [HintSchema],
			default: [],
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
