import mongoose, { Schema, Document } from 'mongoose';

export interface IDiscoveryCall extends Document {
  name: string;
  email: string;
  message: string;
  status: 'Up coming' | 'Completed' | 'No-show';
  createdAt: Date;
  updatedAt: Date;
}

const DiscoveryCallSchema = new Schema<IDiscoveryCall>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['Up coming', 'Completed', 'No-show'],
      default: 'Up coming',
    },
  },
  {
    timestamps: true,
  }
);

// Add text index for searching
DiscoveryCallSchema.index({ name: 'text', email: 'text' });

export const DiscoveryCall = mongoose.models.DiscoveryCall || mongoose.model<IDiscoveryCall>('DiscoveryCall', DiscoveryCallSchema);
