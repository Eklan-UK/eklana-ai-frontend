import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';
import '@/models/class-series';

export interface IClassSession extends Document {
  _id: Types.ObjectId;
  classSeriesId: Types.ObjectId;
  tutorId: Types.ObjectId;
  startUtc: Date;
  endUtc: Date;
  meetingUrl?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  sequenceNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const classSessionSchema = new Schema<IClassSession>(
  {
    classSeriesId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassSeries',
      required: true,
      index: true,
    },
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startUtc: { type: Date, required: true, index: true },
    endUtc: { type: Date, required: true },
    meetingUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    sequenceNumber: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, collection: 'class_sessions' },
);

classSessionSchema.index({ classSeriesId: 1, startUtc: 1 });

const ClassSessionModel =
  models.ClassSession || model<IClassSession>('ClassSession', classSessionSchema);
export default ClassSessionModel;
