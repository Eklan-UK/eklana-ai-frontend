import { Types } from 'mongoose';

export interface DrillAssignment {
  _id: Types.ObjectId;
  drillId: Types.ObjectId;
  learnerId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  dueDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssignmentData {
  drillId: Types.ObjectId;
  learnerId: Types.ObjectId;
  assignedBy: Types.ObjectId;
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

