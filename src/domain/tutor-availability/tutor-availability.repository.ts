import type { Types } from 'mongoose';
import '@/models/class-series';
import '@/models/class-enrollment';
import TutorAvailability, {
  type ITutorAvailability,
  type WeeklyAvailabilityRule,
  type AvailabilityException,
} from '@/models/tutor-availability';
import ClassSeries from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';

export type TutorAvailabilityDTO = {
  timezone: string;
  weeklyRules: WeeklyAvailabilityRule[];
  exceptions: AvailabilityException[];
  bufferMinutes: number;
};

export class TutorAvailabilityRepository {
  async findByTutorId(tutorId: Types.ObjectId): Promise<ITutorAvailability | null> {
    return TutorAvailability.findOne({ tutorId }).lean().exec() as Promise<ITutorAvailability | null>;
  }

  toDTO(doc: ITutorAvailability | null): TutorAvailabilityDTO | null {
    if (!doc) return null;
    return {
      timezone: doc.timezone,
      weeklyRules: doc.weeklyRules ?? [],
      exceptions: doc.exceptions ?? [],
      bufferMinutes: doc.bufferMinutes ?? 0,
    };
  }

  async upsertForTutor(
    tutorId: Types.ObjectId,
    body: TutorAvailabilityDTO,
  ): Promise<ITutorAvailability> {
    const updated = await TutorAvailability.findOneAndUpdate(
      { tutorId },
      {
        $set: {
          tutorId,
          timezone: body.timezone,
          weeklyRules: body.weeklyRules,
          exceptions: body.exceptions,
          bufferMinutes: body.bufferMinutes,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .lean()
      .exec();
    if (!updated) {
      throw new Error('Failed to save tutor availability');
    }
    return updated as unknown as ITutorAvailability;
  }

  /**
   * Learner may read a tutor’s availability only if they have an active enrollment
   * in any active class series taught by that tutor.
   */
  async learnerMayViewTutorAvailability(
    learnerId: Types.ObjectId,
    tutorId: Types.ObjectId,
  ): Promise<boolean> {
    const seriesIds = await ClassSeries.find({
      tutorId,
      isActive: true,
    })
      .distinct('_id')
      .exec();

    if (seriesIds.length === 0) return false;

    const enr = await ClassEnrollment.findOne({
      learnerId,
      classSeriesId: { $in: seriesIds },
      status: 'active',
    })
      .select('_id')
      .lean()
      .exec();

    return !!enr;
  }
}
