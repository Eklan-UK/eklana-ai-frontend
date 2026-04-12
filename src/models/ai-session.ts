import mongoose, { Schema, Document, Model, Types } from "mongoose";
import "@/models/user";
import type {
  AiSessionMode,
  SessionSummaryPayload,
  TranscriptTurn,
} from "@/types/ai-session-summary";

export type { AiSessionMode, SessionSummaryPayload, TranscriptTurn };

export interface IAiSession extends Document {
  userId: Types.ObjectId;
  mode: AiSessionMode;
  topic?: string;
  drillId?: Types.ObjectId;
  transcriptSnapshot: TranscriptTurn[];
  summary: SessionSummaryPayload;
  endedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transcriptTurnSchema = new Schema<TranscriptTurn>(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

const summarySchema = new Schema<SessionSummaryPayload>(
  {
    grammar: {
      headline: { type: String, required: true },
      detail: { type: String },
    },
    vocabulary: {
      headline: { type: String, required: true },
      detail: { type: String },
    },
    flow: {
      headline: { type: String, required: true },
      detail: { type: String },
    },
    strengths: [{ type: String }],
    tips: [{ type: String }],
    encouragement: { type: String, required: true },
    overallScore: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const aiSessionSchema = new Schema<IAiSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["free", "topic", "drill"],
      required: true,
    },
    topic: { type: String },
    drillId: { type: Schema.Types.ObjectId, ref: "Drill" },
    transcriptSnapshot: {
      type: [transcriptTurnSchema],
      required: true,
    },
    summary: { type: summarySchema, required: true },
    endedAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "ai_sessions" },
);

aiSessionSchema.index({ userId: 1, endedAt: -1 });

const AiSession: Model<IAiSession> =
  mongoose.models.AiSession || mongoose.model<IAiSession>("AiSession", aiSessionSchema);

export default AiSession;
