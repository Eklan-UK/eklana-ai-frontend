import mongoose, { Schema, Document, Model, Types } from 'mongoose';
// Import User model to ensure it's registered before this schema references it
import '@/models/user';

export interface IBookmark extends Document {
  // Better Auth (web sign-up, incl. Google/Apple OAuth) assigns UUID string
  // user ids; legacy/mobile accounts use ObjectId. Mixed so both formats
  // can be stored/queried without a cast error.
  userId: Types.ObjectId | string;
  drillId: Types.ObjectId;
  type: 'word' | 'sentence' | 'drill';
  content: string; // The word or sentence being bookmarked, or drillId for drill bookmarks
  translation?: string;
  context?: string; // e.g., the original sentence for a word, or context for a sentence
  createdAt: Date;
  updatedAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
  {
    // Mixed (not ObjectId) so UUID user ids (Better Auth web sign-up, incl.
    // Google/Apple OAuth) can be stored without a cast error. No `ref`
    // since populate cannot reliably resolve a mixed-type field.
    userId: { type: Schema.Types.Mixed, required: true, index: true },
    drillId: { type: Schema.Types.ObjectId, ref: 'Drill', required: true },
    type: { type: String, enum: ['word', 'sentence', 'drill'], required: true },
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
