import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

export interface IDrillCheckpoint extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  drillId: Types.ObjectId;
  drillAssignmentId: Types.ObjectId;
  drillType: string;
  resumeFromIndex: number;
  completedItemCount: number;
  partialResults: Record<string, unknown>;
  startedAt: Date;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const drillCheckpointSchema = new Schema<IDrillCheckpoint>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
      required: true,
    },
    drillType: {
      type: String,
      required: true,
    },
    resumeFromIndex: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    completedItemCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    partialResults: {
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
    collection: 'drill_checkpoints',
  },
);

drillCheckpointSchema.index(
  { userId: 1, drillAssignmentId: 1 },
  { unique: true, sparse: true },
);

const DrillCheckpointModel =
  models.DrillCheckpoint ||
  model<IDrillCheckpoint>('DrillCheckpoint', drillCheckpointSchema);

export default DrillCheckpointModel;
