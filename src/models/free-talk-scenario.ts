import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';
import { FREE_TALK_SCENARIO_TYPES, type FreeTalkScenarioType } from './free-talk-scenario.shared';

export { FREE_TALK_SCENARIO_TYPES, type FreeTalkScenarioType } from './free-talk-scenario.shared';

export interface IFreeTalkScenario extends Document {
	title: string;
	background: string;
	task: string;
	/** Trimmed lines; persisted as string[] (see `normalizeFreeTalkScenarioStringList` for legacy string shapes). */
	include: string[];
	/** Trimmed lines; persisted as string[] (see `normalizeFreeTalkScenarioStringList` for legacy string shapes). */
	usefulPhrases: string[];
	scenarioType: FreeTalkScenarioType;
	hint: string;
	/** When true, all learners see this scenario. When false, only `assignedLearnerIds`. */
	allLearners: boolean;
	/** User ids (role user) who can access the scenario when `allLearners` is false. */
	assignedLearnerIds: Types.ObjectId[];
	createdBy?: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const FreeTalkScenarioSchema = new Schema<IFreeTalkScenario>(
	{
		title: {
			type: String,
			required: [true, 'Title is required'],
			trim: true,
		},
		background: {
			type: String,
			required: [true, 'Background is required'],
			trim: true,
		},
		task: {
			type: String,
			required: [true, 'Task is required'],
			trim: true,
		},
		include: {
			type: [String],
			default: [],
		},
		usefulPhrases: {
			type: [String],
			default: [],
		},
		scenarioType: {
			type: String,
			enum: FREE_TALK_SCENARIO_TYPES,
			required: [true, 'Scenario type is required'],
		},
		hint: {
			type: String,
			default: '',
			trim: true,
		},
		allLearners: {
			type: Boolean,
			default: true,
		},
		assignedLearnerIds: {
			type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
			default: [],
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
	},
	{ timestamps: true }
);

FreeTalkScenarioSchema.index({ assignedLearnerIds: 1 });
FreeTalkScenarioSchema.index({ allLearners: 1 });

const FreeTalkScenario =
	models.FreeTalkScenario ||
	model<IFreeTalkScenario>('FreeTalkScenario', FreeTalkScenarioSchema);

export default FreeTalkScenario;
