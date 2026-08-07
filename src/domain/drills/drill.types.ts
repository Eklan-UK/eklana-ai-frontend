import { Types } from 'mongoose';

export type LearningJourneyPartFilter = 1 | 2 | 3 | 4 | 5;

/**
 * Optional discriminator for drills created via a dedicated product surface
 * (e.g. Eklan Precision Clinic) that reuses the regular Drill Builder
 * infrastructure. Absent = regular drill.
 */
export type DrillSource = 'precision_clinic';

export interface Drill {
  _id: Types.ObjectId;
  title: string;
  type: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  date: Date;
  duration_days: number;
  created_by: string;
  createdById?: Types.ObjectId | string;
  is_active: boolean;
  learning_journey_part?: LearningJourneyPartFilter;
  learning_journey_topic?: string;
  is_bookmarked?: boolean;
  bookmarked_at?: Date | null;
  source?: DrillSource;
  [key: string]: any;
}

export interface DrillListFilters {
  type?: string;
  difficulty?: string;
  studentEmail?: string;
  assignedToIds?: string[];
  createdBy?: string;
  isActive?: boolean;
  assignmentStatus?: 'saved' | 'assigned';
  q?: string;
  isBookmarked?: boolean;
  learningJourneyPart?: LearningJourneyPartFilter;
  learningJourneyTopic?: string;
  /** Only return drills tagged with this source (e.g. 'precision_clinic'). */
  source?: DrillSource;
  /** Exclude drills tagged with this source (e.g. hide 'precision_clinic' from other drill surfaces). */
  excludeSource?: DrillSource;
  limit?: number;
  offset?: number;
}

export interface CreateDrillData {
  title: string;
  type: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  date: Date;
  duration_days?: number;
  created_by: string;
  createdById?: Types.ObjectId | string;
  assigned_to?: string[];
  context?: string;
  audio_example_url?: string;
  tts_voice_key?: string;
  is_active?: boolean;
  is_bookmarked?: boolean;
  bookmarked_at?: Date | null;
  learning_journey_part?: LearningJourneyPartFilter;
  learning_journey_topic?: string;
  source?: DrillSource;
  [key: string]: any;
}

export interface AssignDrillParams {
  drillId: string;
  userIds: string[];
  assignedBy: string;
  dueDate?: Date;
  /** When set, assignedAt is placed in that drill-builder week for each learner. */
  weekNumber?: number;
}

export interface CompleteDrillParams {
  drillId: string;
  drillAssignmentId: string;
  learnerId: string;
  score: number;
  timeSpent: number;
  results: {
    vocabularyResults?: any;
    pronunciationResults?: any;
    roleplayResults?: any;
    matchingResults?: any;
    definitionResults?: any;
    grammarResults?: any;
    sentenceWritingResults?: any;
    sentenceResults?: any;
    summaryResults?: any;
    listeningResults?: any;
    fillBlankResults?: any;
    keyPhrasesResults?: any;
    performanceReviewSnapshot?: Record<string, unknown>;
    deviceInfo?: string;
    platform?: 'web' | 'ios' | 'android';
  };
}

