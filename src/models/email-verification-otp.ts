import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import '@/models/user';

export interface IEmailVerificationOTP extends Document {
  userId: Types.ObjectId;
  email: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

const emailVerificationOTPSchema = new Schema<IEmailVerificationOTP>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'emailverificationotps', timestamps: true }
);

// Auto-delete expired docs
emailVerificationOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailVerificationOTP: Model<IEmailVerificationOTP> =
  (mongoose.models.EmailVerificationOTP as Model<IEmailVerificationOTP>) ??
  mongoose.model<IEmailVerificationOTP>(
    'EmailVerificationOTP',
    emailVerificationOTPSchema
  );

export default EmailVerificationOTP;
