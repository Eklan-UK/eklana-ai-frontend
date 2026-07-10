import { Types } from 'mongoose';
import { MissionEnrollmentRepository } from './mission-enrollment.repository';
import type { LearningJourneyPartId } from './learning-journey.catalog';
import { LEARNING_JOURNEY_PARTS } from './learning-journey.catalog';
import { getActiveLearnerIdsForTutor } from '@/domain/tutor-assignments/tutor-assignment.service';
import { ValidationError } from '@/lib/api/response';

const repo = new MissionEnrollmentRepository();

export async function getEnrolledPartsForLearner(
  learnerId: string,
): Promise<LearningJourneyPartId[]> {
  return repo.findActivePartsForLearner(learnerId);
}

export async function isLearnerEnrolledInPart(
  learnerId: string,
  part: LearningJourneyPartId,
): Promise<boolean> {
  return repo.isLearnerEnrolledInPart(learnerId, part);
}

export async function getEnrolledPartsForLearners(
  learnerIds: string[],
): Promise<Map<string, LearningJourneyPartId[]>> {
  return repo.findActivePartsForLearners(learnerIds);
}

export async function listEnrollmentsForStaff({
  userId,
  userRole,
  learnerIdFilter,
}: {
  userId: Types.ObjectId;
  userRole: string;
  learnerIdFilter?: string;
}): Promise<
  Array<{
    learnerId: string;
    learningJourneyPart: LearningJourneyPartId;
    enrolledAt: string;
    status: 'active';
  }>
> {
  let learnerIds: string[] | undefined;

  if (userRole === 'tutor') {
    const ids = await getActiveLearnerIdsForTutor(userId);
    learnerIds = ids.map((id) => id.toString());
    if (learnerIdFilter) {
      if (!learnerIds.includes(learnerIdFilter)) {
        return [];
      }
      learnerIds = [learnerIdFilter];
    }
  } else if (learnerIdFilter) {
    learnerIds = [learnerIdFilter];
  }

  const rows =
    learnerIds != null
      ? await repo.findActiveEnrollmentsForLearners(learnerIds)
      : await repo.findAllActiveEnrollments();

  return rows.map((row) => ({
    learnerId: row.learnerId,
    learningJourneyPart: row.learningJourneyPart,
    enrolledAt: row.enrolledAt.toISOString(),
    status: 'active' as const,
  }));
}

export async function setLearnerEnrollments({
  learnerId,
  parts,
  enrolledBy,
}: {
  learnerId: string;
  parts: LearningJourneyPartId[];
  enrolledBy: string;
}): Promise<LearningJourneyPartId[]> {
  const validParts = new Set(LEARNING_JOURNEY_PARTS.map((p) => p.part));
  for (const part of parts) {
    if (!validParts.has(part)) {
      throw new ValidationError(`Invalid learning journey part: ${part}`);
    }
  }

  const desired = new Set(parts);
  const current = await repo.findActivePartsForLearner(learnerId);

  for (const part of current) {
    if (!desired.has(part)) {
      await repo.withdrawEnrollment(learnerId, part);
    }
  }

  for (const part of parts) {
    if (!current.includes(part)) {
      await repo.upsertActiveEnrollment({ learnerId, part, enrolledBy });
    }
  }

  return repo.findActivePartsForLearner(learnerId);
}

export async function assertLearnersEnrolledForDrill({
  learnerIds,
  part,
}: {
  learnerIds: string[];
  part: LearningJourneyPartId | undefined;
}): Promise<void> {
  if (!part || learnerIds.length === 0) return;

  const notEnrolled = await repo.assertLearnersEnrolledInPart(learnerIds, part);
  if (notEnrolled.length > 0) {
    throw new ValidationError(
      `The following learners are not enrolled in mission ${part}: ${notEnrolled.join(', ')}`,
    );
  }
}

export { MissionEnrollmentRepository };
