import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

export type ConfidenceLabel =
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Average'
  | 'Developing'
  | 'Needs Improvement';

export type ConfidenceTrend = 'improving' | 'stable' | 'declining';

export interface ILearnerConfidence extends Document {
  learnerId: Types.ObjectId;

  // Raw counts
  drillsAssigned: number;
  drillsCompleted: number;

  // Completion pillar (max 40 pts)
  completionRate: number;       // 0.0 – 1.0
  completionContribution: number; // completionRate × 40

  // Quality pillar (max 60 pts)
  qualityScore: number;         // weighted avg drill quality (0-100)
  qualityContribution: number;  // qualityScore × 0.60

  // Sub-scores for coach diagnostics
  pronunciationConfidence: number; // avg of Speechace-based drills only
  completionConfidence: number;    // avg of non-Speechace drills (matching, listening, etc.)

  // Final metric
  confidenceScore: number;       // 0 – 100
  label: ConfidenceLabel;
  trend: ConfidenceTrend;

  // Rolling history (capped at 20 entries)
  history: Array<{
    score: number;
    label: ConfidenceLabel;
    computedAt: Date;
    drillsCompleted: number;
  }>;

  lastComputedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const learnerConfidenceSchema = new Schema<ILearnerConfidence>(
  {
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    drillsAssigned: { type: Number, default: 0, min: 0 },
    drillsCompleted: { type: Number, default: 0, min: 0 },

    completionRate: { type: Number, default: 0, min: 0, max: 1 },
    completionContribution: { type: Number, default: 0, min: 0, max: 40 },

    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    qualityContribution: { type: Number, default: 0, min: 0, max: 60 },

    pronunciationConfidence: { type: Number, default: 0, min: 0, max: 100 },
    completionConfidence: { type: Number, default: 0, min: 0, max: 100 },

    confidenceScore: { type: Number, default: 0, min: 0, max: 100 },
    label: {
      type: String,
      enum: ['Excellent', 'Very Good', 'Good', 'Average', 'Developing', 'Needs Improvement'],
      default: 'Needs Improvement',
    },
    trend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable',
    },

    history: [
      {
        score: Number,
        label: String,
        computedAt: Date,
        drillsCompleted: Number,
      },
    ],

    lastComputedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'learner_confidence',
  }
);

const LearnerConfidenceModel =
  models.LearnerConfidence ||
  model<ILearnerConfidence>('LearnerConfidence', learnerConfidenceSchema);

export default LearnerConfidenceModel;
