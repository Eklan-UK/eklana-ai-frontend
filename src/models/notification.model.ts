import mongoose, { Schema, Document, Model } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export type NotificationType = 
  | 'drill_assigned'
  | 'drill_reminder'
  | 'drill_reviewed'
  | 'drill_completed'
  | 'daily_focus'
  | 'achievement'
  | 'message'
  | 'tutor_update'
  | 'system';

export interface INotificationData {
  screen?: string;        // For mobile deep linking (e.g., 'DrillDetail')
  resourceId?: string;    // Resource ID (e.g., drill ID)
  resourceType?: string;  // Resource type (e.g., 'drill', 'focus')
  url?: string;           // Web URL for navigation
  [key: string]: any;     // Additional custom data
}

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  data?: INotificationData;
  isRead: boolean;
  readAt?: Date;
  pushSentAt?: Date;
  pushDelivered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true,
    },
    
    // Notification content
    title: { 
      type: String, 
      required: true,
      maxlength: 100,
    },
    body: { 
      type: String, 
      required: true,
      maxlength: 500,
    },
    
    // Categorization for filtering and icons
    type: { 
      type: String, 
      enum: [
        'drill_assigned',
        'drill_reminder',
        'drill_reviewed',
        'drill_completed',
        'daily_focus',
        'achievement',
        'message',
        'tutor_update',
        'system',
      ],
      required: true,
      index: true,
    },
    
    // Deep link and navigation data
    data: {
      screen: String,
      resourceId: String,
      resourceType: String,
      url: String,
    },
    
    // Read status
    isRead: { 
      type: Boolean, 
      default: false,
      index: true,
    },
    readAt: Date,
    
    // Push delivery tracking
    pushSentAt: Date,
    pushDelivered: { 
      type: Boolean, 
      default: false,
    },
  },
  { 
    timestamps: true,
  }
);

// Compound indexes for common queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

// TTL index - auto-delete notifications older than 90 days
NotificationSchema.index(
  { createdAt: 1 }, 
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = async function(userId: string) {
  return this.countDocuments({ userId, isRead: false });
};

// Static method to get recent notifications
NotificationSchema.statics.getRecent = async function(
  userId: string, 
  limit: number = 20,
  skip: number = 0
) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to mark as read
NotificationSchema.statics.markAsRead = async function(
  notificationId: string,
  userId: string
) {
  return this.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

// Static method to mark all as read
NotificationSchema.statics.markAllAsRead = async function(userId: string) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to delete old notifications
NotificationSchema.statics.deleteOld = async function(
  userId: string, 
  daysOld: number = 30
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    userId,
    createdAt: { $lt: cutoffDate },
    isRead: true,
  });
};

export interface INotificationModel extends Model<INotification> {
  getUnreadCount(userId: string): Promise<number>;
  getRecent(userId: string, limit?: number, skip?: number): Promise<INotification[]>;
  markAsRead(notificationId: string, userId: string): Promise<INotification | null>;
  markAllAsRead(userId: string): Promise<any>;
  deleteOld(userId: string, daysOld?: number): Promise<any>;
}

export const Notification = (mongoose.models.Notification as INotificationModel) || 
  mongoose.model<INotification, INotificationModel>('Notification', NotificationSchema);

