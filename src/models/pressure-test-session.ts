import mongoose, { Document, Model, Schema, Types } from "mongoose";
import "@/models/user";

export interface ITestTurn {
  turnNumber: number;
  aiPrompt: string;
  studentResponseText: string;
  latencyMs: number;
}

export interface ITurnFeedback {
  turnNumber: number;
  feedback: string;
  rating: "strong" | "adequate" | "needs_work";
}

export interface IPressureTestSession extends Document {
  userId: Types.ObjectId;
  drillId: string | null;
  level: number;
  levelBefore: number;
  levelAfter: number;
  progressToNextLevel: number;
  overallResponseSpeed: number;
  overallAccuracy: number;
  overallPronunciation: number;
  overallConfidence: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  turnFeedback: ITurnFeedback[];
  turns: ITestTurn[];
  createdAt: Date;
  updatedAt: Date;
}

const testTurnSchema = new Schema<ITestTurn>(
  {
    turnNumber: { type: Number, required: true, min: 1 },
    aiPrompt: { type: String, required: true, trim: true },
    studentResponseText: { type: String, required: true, trim: true },
    latencyMs: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const turnFeedbackSchema = new Schema<ITurnFeedback>(
  {
    turnNumber: { type: Number, required: true },
    feedback: { type: String, required: true, trim: true },
    rating: {
      type: String,
      enum: ["strong", "adequate", "needs_work"],
      required: true,
    },
  },
  { _id: false },
);

const pressureTestSessionSchema = new Schema<IPressureTestSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    drillId: { type: String, default: null, index: true },
    level: { type: Number, required: true, min: 1 },
    levelBefore: { type: Number, required: true, min: 1 },
    levelAfter: { type: Number, required: true, min: 1 },
    progressToNextLevel: { type: Number, required: true, min: 0, max: 100 },
    overallResponseSpeed: { type: Number, required: true, min: 0 },
    overallAccuracy: { type: Number, required: true, min: 0, max: 100 },
    overallPronunciation: { type: Number, required: true, min: 0, max: 100 },
    overallConfidence: { type: Number, required: true, min: 0, max: 100 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    nextSteps: { type: [String], default: [] },
    turnFeedback: { type: [turnFeedbackSchema], default: [] },
    turns: { type: [testTurnSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "pressure_test_sessions",
  },
);

pressureTestSessionSchema.index({ userId: 1, createdAt: -1 });

const PressureTestSession: Model<IPressureTestSession> =
  mongoose.models.PressureTestSession ||
  mongoose.model<IPressureTestSession>("PressureTestSession", pressureTestSessionSchema);

export default PressureTestSession;
