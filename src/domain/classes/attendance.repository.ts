import { Types } from 'mongoose';
import ClassSession from '@/models/class-session';
import ClassSeries from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';
import SessionAttendance, {
  type IAttendanceSource,
  type IAttendanceStatus,
} from '@/models/session-attendance';
import User, { type IUser } from '@/models/user';
import { ValidationError } from '@/lib/api/response';

export interface AttendanceRowDTO {
  learnerId: string;
  displayName: string;
  status: IAttendanceStatus;
  joinedAt?: string;
  source?: IAttendanceSource;
}

export class AttendanceRepository {
  /**
   * Learner marks attendance (e.g. after joining from app). Upserts one row per session+learner.
   */
  async recordLearnerAttendance(params: {
    sessionId: string;
    learnerId: Types.ObjectId;
    status?: IAttendanceStatus;
    source?: IAttendanceSource;
  }): Promise<void> {
    if (!Types.ObjectId.isValid(params.sessionId)) {
      throw new ValidationError('Invalid session ID');
    }
    const session = await ClassSession.findById(params.sessionId).lean();
    if (!session) {
      throw new ValidationError('Session not found');
    }
    const series = await ClassSeries.findById(session.classSeriesId).lean();
    if (!series?.isActive) {
      throw new ValidationError('Class not available');
    }
    const enr = await ClassEnrollment.findOne({
      classSeriesId: series._id,
      learnerId: params.learnerId,
      status: 'active',
    }).lean();
    if (!enr) {
      throw new ValidationError('Not enrolled in this class');
    }

    const status = params.status ?? 'present';
    const source = params.source ?? 'manual';
    const joinedAt = status === 'present' || status === 'late' ? new Date() : undefined;

    await SessionAttendance.findOneAndUpdate(
      { sessionId: session._id, learnerId: params.learnerId },
      {
        $set: {
          status,
          source,
          ...(joinedAt ? { joinedAt } : {}),
        },
        $setOnInsert: {
          sessionId: session._id,
          learnerId: params.learnerId,
        },
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Tutor: all enrolled learners for the series with attendance for this session (if any).
   */
  async listForTutorSession(
    sessionId: string,
    tutorId: Types.ObjectId,
  ): Promise<{ rows: AttendanceRowDTO[] } | null> {
    if (!Types.ObjectId.isValid(sessionId)) {
      return null;
    }
    const session = await ClassSession.findById(sessionId).lean();
    if (!session) return null;

    const series = await ClassSeries.findById(session.classSeriesId).lean();
    if (!series || !series.isActive) return null;
    if (series.tutorId.toString() !== tutorId.toString()) {
      return null;
    }

    const enrollments = await ClassEnrollment.find({
      classSeriesId: series._id,
      status: 'active',
    }).lean();

    const attendance = await SessionAttendance.find({
      sessionId: session._id,
    }).lean();

    const attByLearner = new Map(
      attendance.map((a) => [a.learnerId.toString(), a]),
    );

    const learnerIds = enrollments.map((e) => e.learnerId);
    const users = await User.find({ _id: { $in: learnerIds } })
      .select('firstName lastName email')
      .lean();

    const nameOf = (u: (typeof users)[0]) => {
      const n = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
      return n || u.email || 'Learner';
    };

    const rows: AttendanceRowDTO[] = users
      .map((u) => {
        const id = u._id.toString();
        const a = attByLearner.get(id);
        return {
          learnerId: id,
          displayName: nameOf(u),
          status: a?.status ?? 'absent',
          joinedAt: a?.joinedAt ? new Date(a.joinedAt).toISOString() : undefined,
          source: a?.source,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return { rows };
  }
}
