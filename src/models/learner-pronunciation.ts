import { Schema, model, models, Document, Types } from 'mongoose';

export interface ILearnerPronunciation extends Document {
  learnerId: Types.ObjectId;
  overallScore: number;
  totalWordsPronounced: number;
  history: Array<{
    score: number;
    computedAt: Date;
    wordsCount: number;
  }>;
  lastComputedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const learnerPronunciationSchema = new Schema<ILearnerPronunciation>(
  {
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    overallScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    totalWordsPronounced: {
      type: Number,
      required: true,
      default: 0,
    },
    history: [
      {
        score: Number,
        computedAt: { type: Date, default: Date.now },
        wordsCount: Number,
      },
    ],
    lastComputedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'learner_pronunciation',
  }
);

// Prevent model recompilation in Next.js development
const LearnerPronunciationModel =
  models.LearnerPronunciation ||
  model<ILearnerPronunciation>('LearnerPronunciation', learnerPronunciationSchema);

export default LearnerPronunciationModel;
