import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

/** 0 = Sunday … 6 = Saturday (aligned with Date.getDay()). */
export interface WeeklyAvailabilityRule {
  weekday: number;
  /** Minutes from midnight in tutor availability timezone (0–1439). */
  startMin: number;
  endMin: number;
}

export type AvailabilityExceptionKind = 'block' | 'open';

/** YYYY-MM-DD in tutor availability timezone. */
export interface AvailabilityException {
  date: string;
  kind: AvailabilityExceptionKind;
}

export interface ITutorAvailability extends Document {
  tutorId: Types.ObjectId;
  /** IANA timezone used to interpret weeklyRules and exception dates. */
  timezone: string;
  weeklyRules: WeeklyAvailabilityRule[];
  exceptions: AvailabilityException[];
  /** Minimum gap between this tutor’s sessions when rescheduling (minutes). */
  bufferMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const weeklyRuleSchema = new Schema<WeeklyAvailabilityRule>(
  {
    weekday: { type: Number, required: true, min: 0, max: 6 },
    startMin: { type: Number, required: true, min: 0, max: 1439 },
    endMin: { type: Number, required: true, min: 1, max: 1440 },
  },
  { _id: false },
);

const exceptionSchema = new Schema<AvailabilityException>(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    kind: { type: String, enum: ['block', 'open'], required: true },
  },
  { _id: false },
);

const tutorAvailabilitySchema = new Schema<ITutorAvailability>(
  {
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      default: 'UTC',
    },
    weeklyRules: { type: [weeklyRuleSchema], default: [] },
    exceptions: { type: [exceptionSchema], default: [] },
    bufferMinutes: { type: Number, default: 0, min: 0, max: 240 },
  },
  { timestamps: true, collection: 'tutor_availabilities' },
);

const TutorAvailabilityModel =
  models.TutorAvailability ||
  model<ITutorAvailability>('TutorAvailability', tutorAvailabilitySchema);

export default TutorAvailabilityModel;
