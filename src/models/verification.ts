import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import '@/models/user';

export interface IVerification extends Document {
  userId: Types.ObjectId;
  token?: string;
  expiresAt: Date;
  createdAt: Date;
}

const verificationSchema = new Schema<IVerification>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    token: { type: String, required: false, sparse: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'verifications', timestamps: true }
);

// Create sparse unique index on token (allows multiple nulls)
verificationSchema.index({ token: 1 }, { unique: true, sparse: true });

const Verification: Model<IVerification> =
  (mongoose.models.Verification as Model<IVerification>) ??
  mongoose.model<IVerification>('Verification', verificationSchema);

export default Verification;
