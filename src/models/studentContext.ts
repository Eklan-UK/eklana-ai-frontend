import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

export interface IStudentContext extends Document {
	_id: Types.ObjectId;
	studentId: Types.ObjectId;
	nativeLanguage: string;
	professionalRole: string;
	hospitalUnit: string;
	country: string;
	proficiencyLevel: 'beginner' | 'intermediate' | 'advanced';
	goals: string;
	simulationWeaknesses?: string;
	createdAt: Date;
	updatedAt: Date;
}

const studentContextSchema = new Schema<IStudentContext>(
	{
		studentId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Student ID is required'],
			unique: true,
			index: true,
		},
		nativeLanguage: {
			type: String,
			required: [true, 'Native language is required'],
		},
		professionalRole: {
			type: String,
			required: [true, 'Professional role is required'],
		},
		hospitalUnit: {
			type: String,
			required: [true, 'Hospital unit is required'],
		},
		country: {
			type: String,
			required: [true, 'Country is required'],
		},
		proficiencyLevel: {
			type: String,
			enum: ['beginner', 'intermediate', 'advanced'],
			required: [true, 'Proficiency level is required'],
		},
		goals: {
			type: String,
			required: [true, 'Goals are required'],
		},
		simulationWeaknesses: {
			type: String,
		},
	},
	{
		timestamps: true,
		collection: 'student_contexts',
	}
);

const StudentContext =
	models.StudentContext || model<IStudentContext>('StudentContext', studentContextSchema);
export default StudentContext;
