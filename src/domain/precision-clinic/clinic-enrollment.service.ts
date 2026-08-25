import {
  ClinicEnrollmentRepository,
  type ClinicEnrollmentRecord,
} from './clinic-enrollment.repository';
import { ForbiddenError, ValidationError } from '@/lib/api/response';

export type ClinicEnrollmentRepo = {
  isLearnerEnrolled(learnerId: string): Promise<boolean>;
  findByLearnerId(learnerId: string): Promise<ClinicEnrollmentRecord | null>;
  findActiveEnrollmentsForLearners(
    learnerIds: string[],
  ): Promise<ClinicEnrollmentRecord[]>;
  findAllActiveEnrollments(): Promise<ClinicEnrollmentRecord[]>;
  findNotEnrolledLearnerIds(learnerIds: string[]): Promise<string[]>;
  upsertActiveEnrollment(args: {
    learnerId: string;
    enrolledBy: string;
  }): Promise<void>;
  withdrawEnrollment(learnerId: string): Promise<void>;
};

export type ClinicEnrollmentListItem = {
  learnerId: string;
  enrolledAt: string;
  status: 'active';
};

export class ClinicEnrollmentService {
  constructor(
    private readonly repo: ClinicEnrollmentRepo = new ClinicEnrollmentRepository(),
  ) {}

  async isLearnerEnrolled(learnerId: string): Promise<boolean> {
    return this.repo.isLearnerEnrolled(learnerId);
  }

  async listEnrollmentsForAdmin(
    learnerIds?: string[],
  ): Promise<ClinicEnrollmentListItem[]> {
    const rows =
      learnerIds != null
        ? await this.repo.findActiveEnrollmentsForLearners(learnerIds)
        : await this.repo.findAllActiveEnrollments();

    return rows.map((row) => ({
      learnerId: row.learnerId,
      enrolledAt: row.enrolledAt.toISOString(),
      status: 'active' as const,
    }));
  }

  async getLearnerEnrollment(learnerId: string): Promise<{
    learnerId: string;
    enrolled: boolean;
    enrolledAt: string | null;
    status: 'active' | 'withdrawn' | null;
  }> {
    const row = await this.repo.findByLearnerId(learnerId);
    return {
      learnerId,
      enrolled: row?.status === 'active',
      enrolledAt: row?.enrolledAt ? row.enrolledAt.toISOString() : null,
      status: row?.status ?? null,
    };
  }

  async setLearnerEnrollment({
    learnerId,
    enrolled,
    enrolledBy,
  }: {
    learnerId: string;
    enrolled: boolean;
    enrolledBy: string;
  }): Promise<boolean> {
    const currentlyEnrolled = await this.repo.isLearnerEnrolled(learnerId);

    if (enrolled && !currentlyEnrolled) {
      await this.repo.upsertActiveEnrollment({ learnerId, enrolledBy });
    } else if (!enrolled && currentlyEnrolled) {
      await this.repo.withdrawEnrollment(learnerId);
    }

    return this.repo.isLearnerEnrolled(learnerId);
  }

  async assertLearnersEnrolledForClinic({
    learnerIds,
  }: {
    learnerIds: string[];
  }): Promise<void> {
    if (learnerIds.length === 0) return;

    const notEnrolled = await this.repo.findNotEnrolledLearnerIds(learnerIds);
    if (notEnrolled.length > 0) {
      throw new ValidationError(
        `The following learners are not enrolled in Precision Clinic: ${notEnrolled.join(', ')}`,
      );
    }
  }

  async assertLearnerEnrolledForClinic(learnerId: string): Promise<void> {
    const enrolled = await this.repo.isLearnerEnrolled(learnerId);
    if (!enrolled) {
      throw new ForbiddenError('You are not enrolled in Precision Clinic');
    }
  }
}

const defaultService = new ClinicEnrollmentService();

export async function isLearnerEnrolled(learnerId: string): Promise<boolean> {
  return defaultService.isLearnerEnrolled(learnerId);
}

export async function listEnrollmentsForAdmin(
  learnerIds?: string[],
): Promise<ClinicEnrollmentListItem[]> {
  return defaultService.listEnrollmentsForAdmin(learnerIds);
}

export async function getLearnerEnrollment(learnerId: string) {
  return defaultService.getLearnerEnrollment(learnerId);
}

export async function setLearnerEnrollment(args: {
  learnerId: string;
  enrolled: boolean;
  enrolledBy: string;
}): Promise<boolean> {
  return defaultService.setLearnerEnrollment(args);
}

export async function assertLearnersEnrolledForClinic(args: {
  learnerIds: string[];
}): Promise<void> {
  return defaultService.assertLearnersEnrolledForClinic(args);
}

export async function assertLearnerEnrolledForClinic(
  learnerId: string,
): Promise<void> {
  return defaultService.assertLearnerEnrolledForClinic(learnerId);
}

export { ClinicEnrollmentRepository };
