import { Schema, model, models, Document, Types } from 'mongoose';

export type DrillType =
	| 'vocabulary'
	| 'pronunciation'
	| 'roleplay'
	| 'matching'
	| 'definition'
	| 'grammar'
	| 'sentence_writing'
	| 'fill_blank'
	| 'key_phrases'
	| 'summary';

export interface IPromptTemplate extends Document {
	_id: Types.ObjectId;
	drillType: DrillType;
	topic: string;
	part: string;
	template: string;
	createdAt: Date;
	updatedAt: Date;
}

const promptTemplateSchema = new Schema<IPromptTemplate>(
	{
		drillType: {
			type: String,
			enum: [
				'vocabulary',
				'pronunciation',
				'roleplay',
				'matching',
				'definition',
				'grammar',
				'sentence_writing',
				'fill_blank',
				'key_phrases',
				'summary',
			],
			required: [true, 'Drill type is required'],
		},
		topic: {
			type: String,
			required: [true, 'Topic is required'],
		},
		part: {
			type: String,
			required: [true, 'Part is required'],
		},
		template: {
			type: String,
			required: [true, 'Template is required'],
		},
	},
	{
		timestamps: true,
		collection: 'prompt_templates',
	}
);

promptTemplateSchema.index({ drillType: 1, topic: 1, part: 1 }, { unique: true });

const PromptTemplate =
	models.PromptTemplate || model<IPromptTemplate>('PromptTemplate', promptTemplateSchema);
export default PromptTemplate;
