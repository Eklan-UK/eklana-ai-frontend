import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import { DrillRepository } from './drill.repository';
import { AssignmentRepository } from '../assignments/assignment.repository';
import { AttemptRepository, CreateAttemptData } from '../attempts/attempt.repository';
import { userService } from '@/lib/api/user.service';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/api/response';
import { sendDrillAssignmentNotification } from '@/lib/api/email.service';
import { onDrillAssigned, onDrillCompleted } from '@/services/notification/triggers';
import type { AssignDrillParams, Drill, Drill as DrillType, CreateDrillData, CompleteDrillParams } from './drill.types';
import type { CreateAssignmentData } from '../assignments/assignment.types';

/**
 * Drill Service
 * Contains business logic for drill operations
 */
export class DrillService {
  constructor(
    private drillRepo: DrillRepository,
    private assignmentRepo: AssignmentRepository,
    private attemptRepo: AttemptRepository
  ) {}

  /** 
   * Assign drill to multiple users
   * Handles validation, duplicate checking, assignment creation, and notifications
   */
  async assignDrill(params: AssignDrillParams) {
    // 1. Validate drill exists
    const drill = await this.drillRepo.findById(params.drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // 2. Validate assigner exists
    const assigner = await userService.findById(
      params.assignedBy,
      'role email firstName lastName name'
    ).catch(() => {
      throw new NotFoundError('Assigner');
    });

    // 3. Validate all users exist and have 'user' role
    const users = await userService.findMultipleWithRole(
      params.userIds,
      'user',
      'email firstName lastName'
    );

    // 4. Calculate due date
    let dueDate: Date | undefined;
    if (params.dueDate) {
      dueDate = new Date(params.dueDate);
    } else {
      // Use drill.date as completion date, or calculate from assignment date + duration
      if (drill.date) {
        dueDate = new Date(drill.date);
      } else {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (drill.duration_days || 1));
      }
    }

    // 5. Check for existing assignments (prevent duplicates)
    const existingAssignments = await this.assignmentRepo.findExisting(
      params.drillId,
      params.userIds
    );

    // 6. Prepare new assignments for users that don't have one yet
    const newAssignmentsData: CreateAssignmentData[] = users
      .filter((user) => !existingAssignments.has(user._id.toString()))
      .map((user) => ({
        drillId: new Types.ObjectId(params.drillId),
        learnerId: user._id,
        assignedBy: new Types.ObjectId(params.assignedBy),
        assignedAt: new Date(),
        dueDate: dueDate!,
        status: 'pending' as const,
      }));

    // 7. Create assignments in bulk
    let successfulAssignments: any[] = [];
    if (newAssignmentsData.length > 0) {
      successfulAssignments = await this.assignmentRepo.createBulk(newAssignmentsData);

      // 8. Send notifications asynchronously (don't block response)
      this.sendAssignmentNotifications(successfulAssignments, drill, assigner, dueDate!)
        .catch((err) => {
          logger.error('Error sending notifications', { error: err.message });
        });

      // 9. Update drill's totalAssignments count
      await this.drillRepo.incrementAssignments(
        params.drillId,
        successfulAssignments.length
      );
    }

    logger.info('Drill assigned to users', {
      drillId: drill._id,
      assignedBy: assigner.email,
      userCount: successfulAssignments.length,
    });

    return {
      assignments: successfulAssignments,
      skipped: existingAssignments.size,
      total: successfulAssignments.length,
    };
  }

  /**
   * List drills with filters
   */
  async listDrills(filters: {
    type?: string;
    difficulty?: string;
    studentEmail?: string;
    createdBy?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ drills: DrillType[]; total: number; limit: number; offset: number }> {
    const drills = await this.drillRepo.findMany(filters);
    const query: any = {};

    if (filters.type) query.type = filters.type;
    if (filters.difficulty) query.difficulty = filters.difficulty;
    if (filters.isActive !== undefined) query.is_active = filters.isActive;
    if (filters.createdBy) query.created_by = filters.createdBy;
    if (filters.studentEmail) query.assigned_to = filters.studentEmail;

    const total = await this.drillRepo.count(query);

    return {
      drills,
      total,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    };
  }

  /**
   * Create a new drill with assignments
   */
  async createDrill(params: {
    drillData: CreateDrillData;
    creatorId: string;
    assignedUserIds: string[];
  }): Promise<{ drill: DrillType; assignmentCount: number }> {
    // 1. Validate creator exists
    const creator = await userService.findById(
      params.creatorId,
      'email role firstName lastName name'
    );

    // 2. Validate assigned users
    const assignedUsers = await userService.findMultipleWithRole(
      params.assignedUserIds,
      'user',
      'email firstName lastName'
    );

    // 3. Create drill
    const drill = await this.drillRepo.create({
      ...params.drillData,
      createdById: new Types.ObjectId(params.creatorId),
      created_by: creator.email,
    });

    // 4. Create assignments
    let assignmentCount = 0;
    if (assignedUsers.length > 0) {
      // Check for existing assignments
      const existingAssignments = await this.assignmentRepo.findExisting(
        drill._id.toString(),
        params.assignedUserIds
      );

      // Calculate due date
      const dueDate = params.drillData.date || new Date();

      // Create new assignments
      const newAssignmentsData: CreateAssignmentData[] = assignedUsers
        .filter((user) => !existingAssignments.has(user._id.toString()))
        .map((user) => ({
          drillId: drill._id,
          learnerId: user._id,
          assignedBy: new Types.ObjectId(params.creatorId),
          assignedAt: new Date(),
          dueDate: dueDate,
          status: 'pending' as const,
        }));

      if (newAssignmentsData.length > 0) {
        const createdAssignments = await this.assignmentRepo.createBulk(newAssignmentsData);
        assignmentCount = createdAssignments.length;

        // Send notifications asynchronously
        this.sendAssignmentNotifications(createdAssignments, drill, creator, dueDate)
          .catch((err) => {
            logger.error('Error sending notifications', { error: err.message });
          });

        // Update drill assignment count
        await this.drillRepo.incrementAssignments(drill._id.toString(), assignmentCount);
      }
    }

    logger.info('Drill created successfully', {
      drillId: drill._id,
      createdBy: params.creatorId,
      assignmentsCreated: assignmentCount,
    });

    return { drill, assignmentCount };
  }

  /**
   * Get drill by ID with permission check
   */
  async getDrillById(
    drillId: string,
    userId: string,
    userRole: 'admin' | 'user' | 'tutor',
    assignmentId?: string
  ): Promise<{ drill: DrillType; assignment?: any }> {
    // Validate drill ID
    if (!Types.ObjectId.isValid(drillId)) {
      throw new ValidationError('Invalid drill ID format');
    }

    // Get drill
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // If assignmentId provided, verify assignment
    if (assignmentId) {
      if (!Types.ObjectId.isValid(assignmentId)) {
        throw new ValidationError('Invalid assignment ID format');
      }

      const assignment = await this.assignmentRepo.findMany({
        learnerId: userId,
        drillId: drillId,
        limit: 1,
      });

      const foundAssignment = assignment.find(
        (a: any) => a._id.toString() === assignmentId
      );

      if (!foundAssignment) {
        throw new NotFoundError('Assignment');
      }

      return {
        drill,
        assignment: {
          assignmentId: foundAssignment._id,
          status: foundAssignment.status,
          dueDate: foundAssignment.dueDate,
          completedAt: foundAssignment.completedAt,
        },
      };
    }

    // Role-based permission check
    if (userRole === 'admin') {
      return { drill };
    }

    if (userRole === 'tutor') {
      const isCreator =
        drill.createdById?.toString() === userId ||
        drill.created_by === (await userService.findById(userId, 'email')).email;

      if (!isCreator) {
        throw new ForbiddenError('You do not have permission to view this drill');
      }

      return { drill };
    }

    // User role - must have assignment
    const assignments = await this.assignmentRepo.findMany({
      learnerId: userId,
      drillId: drillId,
      limit: 1,
    });

    if (assignments.length === 0) {
      throw new ForbiddenError('You do not have access to this drill');
    }

    return { drill };
  }

  /**
   * Update drill
   */
  async updateDrill(
    drillId: string,
    userId: string,
    userRole: 'admin' | 'user' | 'tutor',
    data: Partial<CreateDrillData>
  ): Promise<{ drill: DrillType; newAssignmentsCreated: number }> {
    // Validate drill ID
    if (!Types.ObjectId.isValid(drillId)) {
      throw new ValidationError('Invalid drill ID format');
    }

    // Get drill
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // Check permissions
    const user = await userService.findById(userId, 'email role');
    if (userRole !== 'admin' && drill.created_by !== user.email) {
      throw new ForbiddenError('You do not have permission to update this drill');
    }

    // Update drill
    const updatedDrill = await this.drillRepo.update(drillId, data);

    if (!updatedDrill) {
      throw new NotFoundError('Drill');
    }

    // Handle new assignments if assigned_to is provided
    let newAssignmentsCount = 0;
    if (data.assigned_to && data.assigned_to.length > 0) {
      const assignedUsers = await userService.findMultipleWithRole(
        data.assigned_to,
        'user',
        'email'
      );

      const existingAssignments = await this.assignmentRepo.findExisting(
        drillId,
        data.assigned_to
      );

      const newUsers = assignedUsers.filter(
        (u) => !existingAssignments.has(u._id.toString())
      );

      if (newUsers.length > 0) {
        const dueDate = data.date || drill.date || new Date();
        const newAssignmentsData: CreateAssignmentData[] = newUsers.map((user) => ({
          drillId: new Types.ObjectId(drillId),
          learnerId: user._id,
          assignedBy: new Types.ObjectId(userId),
          assignedAt: new Date(),
          dueDate: dueDate,
          status: 'pending' as const,
        }));

        const created = await this.assignmentRepo.createBulk(newAssignmentsData);
        newAssignmentsCount = created.length;

        await this.drillRepo.incrementAssignments(drillId, newAssignmentsCount);
      }
    }

    return { drill: updatedDrill, newAssignmentsCreated: newAssignmentsCount };
  }

  /**
   * Delete drill
   */
  async deleteDrill(
    drillId: string,
    userId: string,
    userRole: 'admin' | 'user' | 'tutor'
  ): Promise<void> {
    // Validate drill ID
    if (!Types.ObjectId.isValid(drillId)) {
      throw new ValidationError('Invalid drill ID format');
    }

    // Get drill
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // Check permissions
    const user = await userService.findById(userId, 'email role');
    if (userRole !== 'admin' && drill.created_by !== user.email) {
      throw new ForbiddenError('You do not have permission to delete this drill');
    }

    // Delete drill
    await this.drillRepo.delete(drillId);
  }

  /**
   * Complete a drill and create attempt record
   */
  async completeDrill(
    drillId: string,
    params: CompleteDrillParams
  ): Promise<{ attempt: any }> {
    // 1. Validate drill exists
    const drill = await this.drillRepo.findById(drillId);
    if (!drill) {
      throw new NotFoundError('Drill');
    }

    // 2. Verify assignment exists and belongs to user
    const assignment = await this.assignmentRepo.findById(params.drillAssignmentId);
    if (!assignment) {
      throw new NotFoundError('Drill assignment');
    }

    // 3. Verify assignment belongs to the user
    if (assignment.learnerId.toString() !== params.learnerId) {
      throw new ForbiddenError('You do not have permission to complete this drill assignment');
    }

    // 4. Verify assignment is for the correct drill
    // Handle both populated (object) and unpopulated (ObjectId) drillId in a type-safe way
    const assignmentDrillId: any = (assignment as any).drillId;
    let assignmentDrillIdStr: string;

    if (assignmentDrillId && typeof assignmentDrillId === 'object' && '_id' in assignmentDrillId) {
      // drillId is populated (object with _id)
      assignmentDrillIdStr = assignmentDrillId._id.toString();
    } else {
      // drillId is likely an ObjectId or string
      assignmentDrillIdStr = String(assignmentDrillId);
    }

    const requestedDrillIdStr = String(drillId);

    if (assignmentDrillIdStr !== requestedDrillIdStr) {
      logger.error('Drill assignment mismatch', {
        assignmentId: params.drillAssignmentId,
        assignmentDrillId: assignmentDrillIdStr,
        requestedDrillId: requestedDrillIdStr,
        learnerId: params.learnerId,
        assignmentDrillIdRaw: assignmentDrillId,
        assignmentDrillIdType: typeof assignmentDrillId,
        requestedDrillIdType: typeof drillId,
      });
      throw new ValidationError(
        `Drill assignment does not match drill ID. Assignment is for drill ${assignmentDrillIdStr}, but you're trying to complete drill ${requestedDrillIdStr}`
      );
    }

    // 5. Create drill attempt
    const attemptData: CreateAttemptData = {
      drillAssignmentId: new Types.ObjectId(params.drillAssignmentId),
      learnerId: new Types.ObjectId(params.learnerId),
      drillId: new Types.ObjectId(drillId),
      startedAt: new Date(Date.now() - params.timeSpent * 1000),
      completedAt: new Date(),
      timeSpent: params.timeSpent,
      score: params.score,
      maxScore: 100,
      vocabularyResults: params.results.vocabularyResults,
      roleplayResults: params.results.roleplayResults,
      matchingResults: params.results.matchingResults,
      definitionResults: params.results.definitionResults,
      grammarResults: params.results.grammarResults,
      sentenceWritingResults: params.results.sentenceWritingResults,
      sentenceResults: params.results.sentenceResults,
      summaryResults: params.results.summaryResults,
      listeningResults: params.results.listeningResults,
      deviceInfo: params.results.deviceInfo,
      platform: params.results.platform || 'web',
    };

    const attempt = await this.attemptRepo.create(attemptData);

    // 6. Update assignment status
    await this.assignmentRepo.updateStatus(
      params.drillAssignmentId,
      'completed',
      new Date()
    );

    // 7. Send notification to tutor (async)
    this.sendCompletionNotification(drill, assignment, params)
      .catch((err) => {
        logger.error('Error sending completion notification', { error: err.message });
      });

    logger.info('Drill completed successfully', {
      drillId,
      assignmentId: params.drillAssignmentId,
      userId: params.learnerId,
      score: params.score,
      attemptId: attempt._id,
    });

    return { attempt };
  }

  /**
   * Send completion notification to tutor
   */
  private async sendCompletionNotification(
    drill: DrillType,
    assignment: any,
    params: CompleteDrillParams
  ): Promise<void> {
    try {
      const fullAssignment = await this.assignmentRepo.findById(
        params.drillAssignmentId
      );

      if (fullAssignment?.assignedBy) {
        const tutorId = fullAssignment.assignedBy.toString();
        const student = await userService.findById(
          params.learnerId,
          'firstName lastName name email'
        );

        await onDrillCompleted(
          tutorId,
          {
            _id: params.learnerId,
            name: (student as any).name,
            firstName: student.firstName,
            lastName: student.lastName,
          },
          {
            _id: drill._id.toString(),
            title: drill.title,
          },
          params.drillAssignmentId,
          params.score
        );
      }
    } catch (error: any) {
      logger.error('Failed to send drill completion notification', {
        error: error.message,
      });
    }
  }

  /**
   * Send email and push notifications for drill assignments
   * Runs asynchronously to not block the API response
   */
  private async sendAssignmentNotifications(
    assignments: any[],
    drill: Drill,
    assigner: any,
    dueDate: Date
  ): Promise<void> {
    const assignerName = userService.getDisplayName(assigner);
    console.log('assignerName', assignerName);

    await Promise.all(
      assignments.map(async (assignment: any) => {
        const user = await userService.findById(
          assignment.learnerId.toString(),
          'email firstName lastName'
        );

        if (!user.email) return;

        // Send email notification
        try {
          await sendDrillAssignmentNotification({
            studentEmail: user.email,
            studentName: user.firstName || 'Student',
            drillTitle: drill.title,
            drillType: drill.type,
            dueDate: dueDate,
            assignerName: assignerName,
            drillId: drill._id.toString(),
            assignmentId: assignment._id?.toString(),
          });
        } catch (emailError: any) {
          logger.error('Failed to send drill assignment email', {
            error: emailError.message,
            studentEmail: user.email,
          });
        }

        // Send push notification
        try {
          await onDrillAssigned(
            assignment.learnerId.toString(),
            {
              _id: drill._id.toString(),
              title: drill.title,
              type: drill.type,
            },
            {
              name: assigner.name,
              firstName: assigner.firstName,
              lastName: assigner.lastName,
            }
          );
        } catch (pushError: any) {
          logger.error('Failed to send drill assignment push notification', {
            error: pushError.message,
            userId: assignment.learnerId.toString(),
          });
        }
      })
    );
  }
}

