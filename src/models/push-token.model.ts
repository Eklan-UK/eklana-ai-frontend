import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPushToken extends Document {
  userId: mongoose.Types.ObjectId;
  platform: 'expo' | 'web' | 'fcm';
  token: string;
  deviceInfo?: {
    deviceName?: string;
    osVersion?: string;
    appVersion?: string;
    browser?: string;
  };
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PushTokenSchema = new Schema<IPushToken>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true,
    },
    
    // Token type determines which service to use
    platform: { 
      type: String, 
      enum: ['expo', 'web', 'fcm'], 
      required: true,
    },
    
    // The actual push token
    // For Expo: ExponentPushToken[xxx]
    // For Web: JSON stringified PushSubscription
    // For FCM: FCM token string
    token: { 
      type: String, 
      required: true,
    },
    
    // Device info for debugging and management
    deviceInfo: {
      deviceName: String,
      osVersion: String,
      appVersion: String,
      browser: String,
    },
    
    // Track validity - set to false if push fails
    isActive: { 
      type: Boolean, 
      default: true,
      index: true,
    },
    
    // Track last successful use
    lastUsedAt: { 
      type: Date, 
      default: Date.now,
    },
  },
  { 
    timestamps: true,
  }
);

// User can have multiple devices, but each token should be unique
PushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
PushTokenSchema.index({ platform: 1, isActive: 1 });

// Static method to register or update a token
PushTokenSchema.statics.registerToken = async function(
  userId: string,
  platform: 'expo' | 'web' | 'fcm',
  token: string,
  deviceInfo?: IPushToken['deviceInfo']
) {
  return this.findOneAndUpdate(
    { userId, token },
    { 
      userId,
      platform,
      token,
      deviceInfo,
      isActive: true,
      lastUsedAt: new Date(),
    },
    { upsert: true, new: true }
  );
};

// Static method to deactivate a token
PushTokenSchema.statics.deactivateToken = async function(token: string) {
  return this.findOneAndUpdate(
    { token },
    { isActive: false }
  );
};

// Static method to get all active tokens for a user
PushTokenSchema.statics.getActiveTokens = async function(userId: string) {
  return this.find({ userId, isActive: true });
};

// Static method to get tokens by platform
PushTokenSchema.statics.getTokensByPlatform = async function(
  userId: string, 
  platform: 'expo' | 'web' | 'fcm'
) {
  return this.find({ userId, platform, isActive: true });
};

export interface IPushTokenModel extends Model<IPushToken> {
  registerToken(
    userId: string,
    platform: 'expo' | 'web' | 'fcm',
    token: string,
    deviceInfo?: IPushToken['deviceInfo']
  ): Promise<IPushToken>;
  deactivateToken(token: string): Promise<IPushToken | null>;
  getActiveTokens(userId: string): Promise<IPushToken[]>;
  getTokensByPlatform(
    userId: string, 
    platform: 'expo' | 'web' | 'fcm'
  ): Promise<IPushToken[]>;
}

export const PushToken = (mongoose.models.PushToken as IPushTokenModel) || 
  mongoose.model<IPushToken, IPushTokenModel>('PushToken', PushTokenSchema);

