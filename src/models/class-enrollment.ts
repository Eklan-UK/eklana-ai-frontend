import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';
import '@/models/class-series';

export interface IClassEnrollment extends Document {
  _id: Types.ObjectId;
  classSeriesId: Types.ObjectId;
  learnerId: Types.ObjectId;
  enrolledAt: Date;
  status: 'active' | 'withdrawn';
  createdAt: Date;
  updatedAt: Date;
}

const classEnrollmentSchema = new Schema<IClassEnrollment>(
  {
    classSeriesId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassSeries',
      required: true,
      index: true,
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    enrolledAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'withdrawn'],
      default: 'active',
    },
  },
  { timestamps: true, collection: 'class_enrollments' },
);

classEnrollmentSchema.index({ classSeriesId: 1, learnerId: 1 }, { unique: true });

const ClassEnrollmentModel =
  models.ClassEnrollment ||
  model<IClassEnrollment>('ClassEnrollment', classEnrollmentSchema);
export default ClassEnrollmentModel;
