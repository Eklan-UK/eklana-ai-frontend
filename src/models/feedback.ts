import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedback extends Document {
  name: string;
  rating: number;
  message: string;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, default: '' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  {
    timestamps: true,
  }
);

FeedbackSchema.index({ userId: 1, createdAt: -1 });

export const Feedback =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>('Feedback', FeedbackSchema);
