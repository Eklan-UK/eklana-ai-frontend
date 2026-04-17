import mongoose, { Document, Model, Schema, Types } from "mongoose";
import "@/models/user";

export type WordQuality = "correct" | "mispronounced" | "missing";

export interface IWordScore {
  word: string;
  score: number;
  quality: WordQuality;
  phonemes?: Array<{ phoneme: string; score: number }>;
}

export interface IRawTurnData {
  turnNumber: number;
  aiPrompt: string;
  studentTranscript: string;
  latencyMs: number;
  audioBase64: string;
  audioMimeType: string;
  audioDurationMs: number;
  pronunciationOverallScore: number;
  pronunciationWordScores: IWordScore[];
  accuracyScore: number;
  confidenceScore: number;
}

export interface IPressureTestRawData extends Document {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  drillId: string | null;
  level: number;
  turns: IRawTurnData[];
  geminiModelUsed: string;
  systemPromptSnapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

const wordScoreSchema = new Schema<IWordScore>(
  {
    word: { type: String, required: true },
    score: { type: Number, required: true },
    quality: {
      type: String,
      enum: ["correct", "mispronounced", "missing"],
      default: "correct",
    },
    phonemes: [
      {
        phoneme: String,
        score: Number,
        _id: false,
      },
    ],
  },
  { _id: false },
);

const rawTurnSchema = new Schema<IRawTurnData>(
  {
    turnNumber: { type: Number, required: true },
    aiPrompt: { type: String, required: true },
    studentTranscript: { type: String, required: true },
    latencyMs: { type: Number, required: true },
    audioBase64: { type: String, required: true },
    audioMimeType: { type: String, default: "audio/webm" },
    audioDurationMs: { type: Number, default: 0 },
    pronunciationOverallScore: { type: Number, default: 0 },
    pronunciationWordScores: { type: [wordScoreSchema], default: [] },
    accuracyScore: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
  },
  { _id: false },
);

const pressureTestRawDataSchema = new Schema<IPressureTestRawData>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "PressureTestSession",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    drillId: { type: String, default: null },
    level: { type: Number, required: true },
    turns: { type: [rawTurnSchema], default: [] },
    geminiModelUsed: { type: String, default: "" },
    systemPromptSnapshot: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "pressure_test_raw_data",
  },
);

pressureTestRawDataSchema.index({ userId: 1, createdAt: -1 });

const PressureTestRawData: Model<IPressureTestRawData> =
  mongoose.models.PressureTestRawData ||
  mongoose.model<IPressureTestRawData>(
    "PressureTestRawData",
    pressureTestRawDataSchema,
  );

export default PressureTestRawData;
