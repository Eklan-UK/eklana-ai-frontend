import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import '@/models/user';

export interface IPasswordOTP extends Document {
  userId: Types.ObjectId;
  email: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

const passwordOTPSchema = new Schema<IPasswordOTP>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'passwordotps', timestamps: true }
);

// Index for cleanup
passwordOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordOTP: Model<IPasswordOTP> =
  (mongoose.models.PasswordOTP as Model<IPasswordOTP>) ??
  mongoose.model<IPasswordOTP>('PasswordOTP', passwordOTPSchema);

export default PasswordOTP;
