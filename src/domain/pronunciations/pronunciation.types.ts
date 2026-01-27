import { Types } from 'mongoose';

export interface Pronunciation {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  text: string;
  phonetic?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  audioUrl?: string;
  audioFileName?: string;
  audioDuration?: number;
  useTTS: boolean;
  createdBy: Types.ObjectId;
  isActive: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePronunciationData {
  title: string;
  description?: string;
  text: string;
  phonetic?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  audioUrl?: string;
  audioFileName?: string;
  audioDuration?: number;
  useTTS?: boolean;
  tags?: string[];
  isActive?: boolean;
}

export interface PronunciationQueryFilters {
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AssignPronunciationParams {
  pronunciationId: string;
  learnerIds: string[];
  assignedBy: string;
  dueDate?: Date;
}

export interface SubmitPronunciationAttemptParams {
  pronunciationId: string;
  learnerId: string;
  assignmentId?: string;
  audioBase64: string;
  passingThreshold?: number;
}

