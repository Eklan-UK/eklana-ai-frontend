import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

export interface ILearnerPrecisionClinicEnrollment extends Document {
  _id: Types.ObjectId;
  learnerId: Types.ObjectId | string;
  enrolledBy: Types.ObjectId | string;
  enrolledAt: Date;
  status: 'active' | 'withdrawn';
  createdAt: Date;
  updatedAt: Date;
}

const learnerPrecisionClinicEnrollmentSchema =
  new Schema<ILearnerPrecisionClinicEnrollment>(
    {
      learnerId: {
        type: Schema.Types.Mixed,
        ref: 'User',
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
    { timestamps: true, collection: 'learner_precision_clinic_enrollments' },
  );

learnerPrecisionClinicEnrollmentSchema.index({ learnerId: 1 }, { unique: true });

const LearnerPrecisionClinicEnrollmentModel =
  models.LearnerPrecisionClinicEnrollment ||
  model<ILearnerPrecisionClinicEnrollment>(
    'LearnerPrecisionClinicEnrollment',
    learnerPrecisionClinicEnrollmentSchema,
  );

export default LearnerPrecisionClinicEnrollmentModel;
