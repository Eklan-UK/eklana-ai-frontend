import { Types } from 'mongoose';

export interface Drill {
  _id: Types.ObjectId;
  title: string;
  type: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  date: Date;
  duration_days: number;
  created_by: string;
  createdById?: Types.ObjectId;
  is_active: boolean;
  [key: string]: any;
}

export interface CreateDrillData {
  title: string;
  type: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  date: Date;
  duration_days?: number;
  created_by: string;
  createdById?: Types.ObjectId;
  assigned_to?: string[];
  context?: string;
  audio_example_url?: string;
  is_active?: boolean;
  [key: string]: any;
}

export interface AssignDrillParams {
  drillId: string;
  userIds: string[];
  assignedBy: string;
  dueDate?: Date;
}

export interface CompleteDrillParams {
  drillId: string;
  drillAssignmentId: string;
  learnerId: string;
  score: number;
  timeSpent: number;
  results: {
    vocabularyResults?: any;
    roleplayResults?: any;
    matchingResults?: any;
    definitionResults?: any;
    grammarResults?: any;
    sentenceWritingResults?: any;
    sentenceResults?: any;
    summaryResults?: any;
    listeningResults?: any;
    deviceInfo?: string;
    platform?: 'web' | 'ios' | 'android';
  };
}

