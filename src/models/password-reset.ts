import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import '@/models/user';

export interface IPasswordReset extends Document {
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'passwordresets', timestamps: true }
);

const PasswordReset: Model<IPasswordReset> =
  (mongoose.models.PasswordReset as Model<IPasswordReset>) ??
  mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema);

export default PasswordReset;
