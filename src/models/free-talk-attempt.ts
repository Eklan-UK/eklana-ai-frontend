import { Schema, model, models, Document, Types } from "mongoose";
import "@/models/user";

export type FreeTalkAttemptGradeBehaviour = {
  id: number;
  name: string;
  result: "full" | "partial" | "none";
  score: number;
};

export type FreeTalkAttemptGradeResult = {
  overallScore: number;
  competencyLevel: string;
  behaviours: FreeTalkAttemptGradeBehaviour[];
  rawScore: number;
  maxScore: number;
};

export interface IFreeTalkAttempt extends Document {
  _id: Types.ObjectId;
  // Better Auth (web sign-up, incl. Google/Apple OAuth) assigns UUID string
  // user ids; legacy/mobile accounts use ObjectId. Mixed so both formats
  // can be stored/queried without a cast error.
  learnerId: Types.ObjectId | string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioType: string;
  feedbackText: string;
  gradeResult: FreeTalkAttemptGradeResult | null;
  audioUrl?: string;
  audioPublicId?: string;
  audioMimeType?: string;
  durationMs?: number;
  usedVoice: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gradeBehaviourSchema = new Schema<FreeTalkAttemptGradeBehaviour>(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    result: { type: String, enum: ["full", "partial", "none"], required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const gradeResultSchema = new Schema<FreeTalkAttemptGradeResult>(
  {
    overallScore: { type: Number, required: true },
    competencyLevel: { type: String, required: true },
    behaviours: { type: [gradeBehaviourSchema], default: [] },
    rawScore: { type: Number, required: true },
    maxScore: { type: Number, required: true },
  },
  { _id: false }
);

const freeTalkAttemptSchema = new Schema<IFreeTalkAttempt>(
  {
    learnerId: {
      // Mixed (not ObjectId) so UUID user ids (Better Auth web sign-up,
      // incl. Google/Apple OAuth) can be stored without a cast error.
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    scenarioId: { type: String, required: true, trim: true },
    scenarioTitle: { type: String, required: true, trim: true },
    scenarioType: { type: String, required: true, trim: true },
    feedbackText: { type: String, default: "" },
    gradeResult: { type: gradeResultSchema, default: null },
    audioUrl: { type: String },
    audioPublicId: { type: String },
    audioMimeType: { type: String },
    durationMs: { type: Number, min: 0 },
    usedVoice: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "free_talk_attempts",
  }
);

freeTalkAttemptSchema.index({ learnerId: 1, createdAt: -1 });

const FreeTalkAttemptModel =
  models.FreeTalkAttempt || model<IFreeTalkAttempt>("FreeTalkAttempt", freeTalkAttemptSchema);

export default FreeTalkAttemptModel;
