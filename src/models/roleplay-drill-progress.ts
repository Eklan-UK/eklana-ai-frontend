import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

export type RoleplayProgressSource = 'assignment' | 'weekly_challenge';

export interface RoleplayTurnProgress {
  passed: boolean;
  score: number | null;
  attempts: number;
}

export interface RoleplayTurnAnalytics {
  sceneIndex: number;
  turnIndex: number;
  text: string;
  score: number;
  textScore?: Record<string, unknown> | null;
  attempts: number;
  timestamp: Date;
}

export interface IRoleplayDrillProgress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  source: RoleplayProgressSource;
  drillId: Types.ObjectId;
  drillAssignmentId?: Types.ObjectId;
  challengeId?: Types.ObjectId;
  challengeItemIndex?: number;
  weekStartDate?: string;
  currentSceneIndex: number;
  currentTurnIndex: number;
  pausedAtSceneBreak: boolean;
  completedSceneIndex?: number;
  turnProgress: Record<string, RoleplayTurnProgress>;
  sessionAnalytics: RoleplayTurnAnalytics[];
  roleMode: 'original' | 'swapped';
  originalRoleProgress: Record<string, RoleplayTurnProgress>;
  swappedRoleProgress: Record<string, RoleplayTurnProgress>;
  startedAt: Date;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const turnProgressEntrySchema = {
  passed: { type: Boolean, default: false },
  score: { type: Number, default: null },
  attempts: { type: Number, default: 0, min: 0 },
};

const turnAnalyticsEntrySchema = {
  sceneIndex: { type: Number, required: true, min: 0 },
  turnIndex: { type: Number, required: true, min: 0 },
  text: { type: String, required: true },
  score: { type: Number, required: true },
  textScore: { type: Schema.Types.Mixed, default: null },
  attempts: { type: Number, default: 0, min: 0 },
  timestamp: { type: Date, default: Date.now },
};

const roleplayDrillProgressSchema = new Schema<IRoleplayDrillProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['assignment', 'weekly_challenge'],
      required: true,
    },
    drillId: {
      type: Schema.Types.ObjectId,
      ref: 'Drill',
      required: true,
      index: true,
    },
    drillAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'DrillAssignment',
      default: null,
    },
    challengeId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    challengeItemIndex: {
      type: Number,
      min: 0,
      default: null,
    },
    weekStartDate: {
      type: String,
      default: null,
    },
    currentSceneIndex: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currentTurnIndex: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    pausedAtSceneBreak: {
      type: Boolean,
      default: false,
    },
    completedSceneIndex: {
      type: Number,
      min: 0,
      default: null,
    },
    turnProgress: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sessionAnalytics: {
      type: [turnAnalyticsEntrySchema],
      default: [],
    },
    roleMode: {
      type: String,
      enum: ['original', 'swapped'],
      default: 'original',
    },
    originalRoleProgress: {
      type: Schema.Types.Mixed,
      default: {},
    },
    swappedRoleProgress: {
      type: Schema.Types.Mixed,
      default: {},
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'roleplay_drill_progress',
  },
);

roleplayDrillProgressSchema.index(
  { userId: 1, drillAssignmentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: 'assignment',
      drillAssignmentId: { $type: 'objectId' },
    },
  },
);

roleplayDrillProgressSchema.index(
  { userId: 1, challengeId: 1, challengeItemIndex: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: 'weekly_challenge',
      challengeId: { $type: 'objectId' },
    },
  },
);

const RoleplayDrillProgressModel =
  models.RoleplayDrillProgress ||
  model<IRoleplayDrillProgress>('RoleplayDrillProgress', roleplayDrillProgressSchema);

export default RoleplayDrillProgressModel;
