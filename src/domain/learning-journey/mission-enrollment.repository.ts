import { Types } from 'mongoose';
import LearnerMissionEnrollment from '@/models/learner-mission-enrollment';
import type { LearningJourneyPartId } from './learning-journey.catalog';
import { toUserIdQuery, toUserIdQueryMulti } from '@/lib/api/user-id';

export type MissionEnrollmentRecord = {
  learnerId: string;
  learningJourneyPart: LearningJourneyPartId;
  enrolledBy: string;
  enrolledAt: Date;
  status: 'active' | 'withdrawn';
};

export class MissionEnrollmentRepository {
  async findActivePartsForLearner(learnerId: string): Promise<LearningJourneyPartId[]> {
    const rows = await LearnerMissionEnrollment.find({
      learnerId: toUserIdQuery(learnerId),
      status: 'active',
    })
      .select('learningJourneyPart')
      .lean()
      .exec();

    return rows
      .map((r) => r.learningJourneyPart as LearningJourneyPartId)
      .sort((a, b) => a - b);
  }

  async findActivePartsForLearners(
    learnerIds: string[],
  ): Promise<Map<string, LearningJourneyPartId[]>> {
    const map = new Map<string, LearningJourneyPartId[]>();
    if (learnerIds.length === 0) return map;

    for (const id of learnerIds) {
      map.set(id, []);
    }

    const rows = await LearnerMissionEnrollment.find({
      learnerId: { $in: toUserIdQueryMulti(learnerIds) },
      status: 'active',
    })
      .select('learnerId learningJourneyPart')
      .lean()
      .exec();

    for (const row of rows) {
      const key = String(row.learnerId);
      const existing = map.get(key) ?? [];
      existing.push(row.learningJourneyPart as LearningJourneyPartId);
      map.set(key, existing);
    }

    for (const [key, parts] of map) {
      map.set(
        key,
        [...parts].sort((a, b) => a - b),
      );
    }

    return map;
  }

  async findActiveEnrollmentsForLearners(
    learnerIds: string[],
  ): Promise<MissionEnrollmentRecord[]> {
    if (learnerIds.length === 0) return [];

    const rows = await LearnerMissionEnrollment.find({
      learnerId: { $in: toUserIdQueryMulti(learnerIds) },
      status: 'active',
    })
      .select('learnerId learningJourneyPart enrolledBy enrolledAt status')
      .lean()
      .exec();

    return rows.map((row) => ({
      learnerId: String(row.learnerId),
      learningJourneyPart: row.learningJourneyPart as LearningJourneyPartId,
      enrolledBy: String(row.enrolledBy),
      enrolledAt: row.enrolledAt as Date,
      status: row.status as 'active' | 'withdrawn',
    }));
  }

  async findAllActiveEnrollments(): Promise<MissionEnrollmentRecord[]> {
    const rows = await LearnerMissionEnrollment.find({ status: 'active' })
      .select('learnerId learningJourneyPart enrolledBy enrolledAt status')
      .lean()
      .exec();

    return rows.map((row) => ({
      learnerId: String(row.learnerId),
      learningJourneyPart: row.learningJourneyPart as LearningJourneyPartId,
      enrolledBy: String(row.enrolledBy),
      enrolledAt: row.enrolledAt as Date,
      status: row.status as 'active' | 'withdrawn',
    }));
  }

  async upsertActiveEnrollment({
    learnerId,
    part,
    enrolledBy,
  }: {
    learnerId: string;
    part: LearningJourneyPartId;
    enrolledBy: string;
  }): Promise<void> {
    await LearnerMissionEnrollment.findOneAndUpdate(
      {
        learnerId: toUserIdQuery(learnerId),
        learningJourneyPart: part,
      },
      {
        $set: {
          status: 'active',
          enrolledBy: toUserIdQuery(enrolledBy),
          enrolledAt: new Date(),
        },
        $setOnInsert: {
          learnerId: toUserIdQuery(learnerId),
          learningJourneyPart: part,
        },
      },
      { upsert: true, new: true },
    ).exec();
  }

  async withdrawEnrollment(
    learnerId: string,
    part: LearningJourneyPartId,
  ): Promise<void> {
    await LearnerMissionEnrollment.findOneAndUpdate(
      {
        learnerId: toUserIdQuery(learnerId),
        learningJourneyPart: part,
        status: 'active',
      },
      { $set: { status: 'withdrawn' } },
    ).exec();
  }

  async isLearnerEnrolledInPart(
    learnerId: string,
    part: LearningJourneyPartId,
  ): Promise<boolean> {
    const row = await LearnerMissionEnrollment.findOne({
      learnerId: toUserIdQuery(learnerId),
      learningJourneyPart: part,
      status: 'active',
    })
      .select('_id')
      .lean()
      .exec();
    return !!row;
  }

  async assertLearnersEnrolledInPart(
    learnerIds: string[],
    part: LearningJourneyPartId,
  ): Promise<string[]> {
    if (learnerIds.length === 0) return [];

    const enrolledMap = await this.findActivePartsForLearners(learnerIds);
    return learnerIds.filter((id) => {
      const parts = enrolledMap.get(id) ?? [];
      return !parts.includes(part);
    });
  }
}
