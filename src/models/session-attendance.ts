import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';
import '@/models/class-session';

export type IAttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type IAttendanceSource = 'join_token' | 'provider_webhook' | 'manual';

export interface ISessionAttendance extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  learnerId: Types.ObjectId;
  status: IAttendanceStatus;
  joinedAt?: Date;
  source: IAttendanceSource;
  createdAt: Date;
  updatedAt: Date;
}

const sessionAttendanceSchema = new Schema<ISessionAttendance>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassSession',
      required: true,
      index: true,
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      required: true,
      default: 'present',
    },
    joinedAt: { type: Date },
    source: {
      type: String,
      enum: ['join_token', 'provider_webhook', 'manual'],
      default: 'manual',
    },
  },
  { timestamps: true, collection: 'session_attendances' },
);

sessionAttendanceSchema.index({ sessionId: 1, learnerId: 1 }, { unique: true });

const SessionAttendanceModel =
  models.SessionAttendance ||
  model<ISessionAttendance>('SessionAttendance', sessionAttendanceSchema);

export default SessionAttendanceModel;
