import { Types } from 'mongoose';

// learnerId accepts Types.ObjectId (legacy/mobile users) or a UUID string
// (Better Auth web sign-up, incl. Google/Apple OAuth) — see
// src/models/drill-assignment.ts and src/lib/api/user-id.ts.
export interface DrillAssignment {
  _id: Types.ObjectId;
  drillId: Types.ObjectId;
  learnerId: Types.ObjectId | string;
  assignedBy: Types.ObjectId | string;
  assignedAt: Date;
  dueDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssignmentData {
  drillId: Types.ObjectId;
  learnerId: Types.ObjectId | string;
  assignedBy: Types.ObjectId | string;
  assignedAt: Date;
  dueDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
}

export interface AssignmentFilters {
  learnerId?: string;
  drillId?: string;
  status?: string;
  assignedBy?: string;
  limit?: number;
  offset?: number;
}

