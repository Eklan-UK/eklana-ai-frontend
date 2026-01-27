import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IBookmark extends Document {
  userId: Types.ObjectId;
  drillId: Types.ObjectId;
  type: 'word' | 'sentence';
  content: string; // The word or sentence being bookmarked
  translation?: string;
  context?: string; // e.g., the original sentence for a word, or context for a sentence
  createdAt: Date;
  updatedAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    drillId: { type: Schema.Types.ObjectId, ref: 'Drill', required: true },
    type: { type: String, enum: ['word', 'sentence'], required: true },
    content: { type: String, required: true },
    translation: { type: String },
    context: { type: String },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate bookmarks for the same user, drill, and content
BookmarkSchema.index({ userId: 1, drillId: 1, content: 1 }, { unique: true });

const Bookmark: Model<IBookmark> =
  mongoose.models.Bookmark || mongoose.model<IBookmark>('Bookmark', BookmarkSchema);

export default Bookmark;
