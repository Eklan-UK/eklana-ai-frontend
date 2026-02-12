// models/activity.ts - Track user activity for recent activity display
import { Schema, model, models, Document, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IActivity extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'drill' | 'pronunciation' | 'lesson';
  resourceId: Types.ObjectId;
  action: 'viewed' | 'started' | 'completed';
  metadata?: {
    title?: string;
    type?: string;
    score?: number;
    duration?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['drill', 'pronunciation', 'lesson'],
      required: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      enum: ['viewed', 'started', 'completed'],
      required: true,
    },
    metadata: {
      title: String,
      type: String,
      score: Number,
      duration: Number,
    },
  },
  {
    timestamps: true,
    collection: 'activities',
  }
);

// Compound index for querying user's recent activities
activitySchema.index({ userId: 1, createdAt: -1 });

// TTL index to auto-delete old activities after 30 days (optional)
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Activity = models.Activity || model<IActivity>('Activity', activitySchema);
export default Activity;

