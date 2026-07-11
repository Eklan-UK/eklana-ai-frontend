import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

export type LearningJourneyPartNumber = 1 | 2 | 3 | 4 | 5;

export interface ILearnerMissionEnrollment extends Document {
  _id: Types.ObjectId;
  learnerId: Types.ObjectId | string;
  learningJourneyPart: LearningJourneyPartNumber;
  enrolledBy: Types.ObjectId | string;
  enrolledAt: Date;
  status: 'active' | 'withdrawn';
  createdAt: Date;
  updatedAt: Date;
}

const learnerMissionEnrollmentSchema = new Schema<ILearnerMissionEnrollment>(
  {
    learnerId: {
      type: Schema.Types.Mixed,
      ref: 'User',
      required: true,
      index: true,
    },
    learningJourneyPart: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      required: true,
    },
    enrolledBy: {
      type: Schema.Types.Mixed,
      ref: 'User',
      required: true,
    },
    enrolledAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'withdrawn'],
      default: 'active',
    },
  },
  { timestamps: true, collection: 'learner_mission_enrollments' },
);

learnerMissionEnrollmentSchema.index(
  { learnerId: 1, learningJourneyPart: 1 },
  { unique: true },
);

const LearnerMissionEnrollmentModel =
  models.LearnerMissionEnrollment ||
  model<ILearnerMissionEnrollment>(
    'LearnerMissionEnrollment',
    learnerMissionEnrollmentSchema,
  );

export default LearnerMissionEnrollmentModel;
