import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

export interface IClassSeries extends Document {
  _id: Types.ObjectId;
  tutorId: Types.ObjectId;
  title: string;
  classType: 'group' | 'individual';
  timezone: string;
  totalSessionsPlanned: number;
  scheduleDayLabels: string[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  recurrenceRule: 'weekly' | 'none';
  createdBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classSeriesSchema = new Schema<IClassSeries>(
  {
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, default: '', trim: true },
    classType: {
      type: String,
      enum: ['group', 'individual'],
      required: true,
    },
    timezone: { type: String, required: true, default: 'UTC' },
    totalSessionsPlanned: { type: Number, required: true, min: 1, default: 1 },
    scheduleDayLabels: [{ type: String }],
    scheduleStartTime: { type: String, default: '' },
    scheduleEndTime: { type: String, default: '' },
    recurrenceRule: {
      type: String,
      enum: ['weekly', 'none'],
      default: 'none',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'class_series' },
);

const ClassSeriesModel =
  models.ClassSeries || model<IClassSeries>('ClassSeries', classSeriesSchema);
export default ClassSeriesModel;
