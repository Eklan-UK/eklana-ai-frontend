import LearnerPrecisionClinicEnrollment from '@/models/learner-precision-clinic-enrollment';
import { toUserIdQuery, toUserIdQueryMulti } from '@/lib/api/user-id';

export type ClinicEnrollmentRecord = {
  learnerId: string;
  enrolledBy: string;
  enrolledAt: Date;
  status: 'active' | 'withdrawn';
};

function toRecord(row: {
  learnerId: unknown;
  enrolledBy: unknown;
  enrolledAt: Date;
  status: 'active' | 'withdrawn';
}): ClinicEnrollmentRecord {
  return {
    learnerId: String(row.learnerId),
    enrolledBy: String(row.enrolledBy),
    enrolledAt: row.enrolledAt as Date,
    status: row.status,
  };
}

export class ClinicEnrollmentRepository {
  async isLearnerEnrolled(learnerId: string): Promise<boolean> {
    const row = await LearnerPrecisionClinicEnrollment.findOne({
      learnerId: toUserIdQuery(learnerId),
      status: 'active',
    })
      .select('_id')
      .lean()
      .exec();
    return !!row;
  }

  async findByLearnerId(
    learnerId: string,
  ): Promise<ClinicEnrollmentRecord | null> {
    const row = await LearnerPrecisionClinicEnrollment.findOne({
      learnerId: toUserIdQuery(learnerId),
    })
      .select('learnerId enrolledBy enrolledAt status')
      .lean()
      .exec();
    return row ? toRecord(row) : null;
  }

  async findActiveEnrollmentsForLearners(
    learnerIds: string[],
  ): Promise<ClinicEnrollmentRecord[]> {
    if (learnerIds.length === 0) return [];

    const rows = await LearnerPrecisionClinicEnrollment.find({
      learnerId: { $in: toUserIdQueryMulti(learnerIds) },
      status: 'active',
    })
      .select('learnerId enrolledBy enrolledAt status')
      .lean()
      .exec();

    return rows.map(toRecord);
  }

  async findAllActiveEnrollments(): Promise<ClinicEnrollmentRecord[]> {
    const rows = await LearnerPrecisionClinicEnrollment.find({
      status: 'active',
    })
      .select('learnerId enrolledBy enrolledAt status')
      .lean()
      .exec();

    return rows.map(toRecord);
  }

  async findNotEnrolledLearnerIds(learnerIds: string[]): Promise<string[]> {
    if (learnerIds.length === 0) return [];

    const rows = await LearnerPrecisionClinicEnrollment.find({
      learnerId: { $in: toUserIdQueryMulti(learnerIds) },
      status: 'active',
    })
      .select('learnerId')
      .lean()
      .exec();

    const enrolledKeys = new Set(rows.map((row) => String(row.learnerId)));
    return learnerIds.filter((id) => !enrolledKeys.has(id));
  }

  async upsertActiveEnrollment({
    learnerId,
    enrolledBy,
  }: {
    learnerId: string;
    enrolledBy: string;
  }): Promise<void> {
    await LearnerPrecisionClinicEnrollment.findOneAndUpdate(
      { learnerId: toUserIdQuery(learnerId) },
      {
        $set: {
          status: 'active',
          enrolledBy: toUserIdQuery(enrolledBy),
          enrolledAt: new Date(),
        },
        $setOnInsert: {
          learnerId: toUserIdQuery(learnerId),
        },
      },
      { upsert: true, new: true },
    ).exec();
  }

  async withdrawEnrollment(learnerId: string): Promise<void> {
    await LearnerPrecisionClinicEnrollment.findOneAndUpdate(
      {
        learnerId: toUserIdQuery(learnerId),
        status: 'active',
      },
      { $set: { status: 'withdrawn' } },
    ).exec();
  }
}
