import mongoose, { Schema, Document, Model, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IFutureSelf extends Document {
  userId: Types.ObjectId;
  videoUrl: string; // Cloudinary URL
  publicId: string; // Cloudinary public ID for deletion
  duration?: number; // Video duration in seconds
  thumbnailUrl?: string; // Optional thumbnail
  title?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FutureSelfSchema = new Schema<IFutureSelf>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
    },
    thumbnailUrl: {
      type: String,
    },
    title: {
      type: String,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    collection: 'future_selves',
  }
);

// Index for querying user's future self videos
FutureSelfSchema.index({ userId: 1, createdAt: -1 });

// Ensure only one future self video per user (unique constraint)
FutureSelfSchema.index({ userId: 1 }, { unique: true });

const FutureSelf: Model<IFutureSelf> =
  mongoose.models.FutureSelf || mongoose.model<IFutureSelf>('FutureSelf', FutureSelfSchema);

export default FutureSelf;





