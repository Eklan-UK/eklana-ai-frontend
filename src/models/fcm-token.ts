/**
 * FCM Token Model
 * Stores Firebase Cloud Messaging tokens for push notifications
 */

import mongoose, { Schema, Document, Model } from "mongoose";
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IFCMToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    browser?: string;
  };
  registeredAt: Date;
  lastSeenAt: Date;
  deregisteredAt?: Date;
  isActive: boolean;
}

const FCMTokenSchema = new Schema<IFCMToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceInfo: {
      userAgent: String,
      platform: String,
      browser: String,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    deregisteredAt: Date,
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Create TTL index to automatically delete inactive tokens after 60 days
FCMTokenSchema.index(
  { deregisteredAt: 1 },
  {
    expireAfterSeconds: 5184000, // 60 days
    partialFilterExpression: { isActive: false },
  },
);

const FCMToken: Model<IFCMToken> =
  mongoose.models.FCMToken ||
  mongoose.model<IFCMToken>("FCMToken", FCMTokenSchema);

export default FCMToken;
