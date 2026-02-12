import mongoose, { Schema, Document, Model, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IDailyReflection extends Document {
  userId: Types.ObjectId;
  content: string; // User's input/reflection text only
  mood: string; // Required - mood selected by user
  prompt: string; // Single prompt/question specific to the selected mood (auto-determined)
  createdAt: Date;
  updatedAt: Date;
}

const DailyReflectionSchema = new Schema<IDailyReflection>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    mood: {
      type: String,
      enum: ['comfortable', 'okay', 'uncertain', 'nervous', 'struggled'],
      required: true,
    },
    prompt: {
      type: String,
      maxlength: 200,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'daily_reflections',
  }
);

// Index for querying user's reflections
DailyReflectionSchema.index({ userId: 1, createdAt: -1 });

const DailyReflection: Model<IDailyReflection> =
  mongoose.models.DailyReflection || mongoose.model<IDailyReflection>('DailyReflection', DailyReflectionSchema);

export default DailyReflection;





