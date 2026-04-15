import mongoose, { Types } from 'mongoose';
import ClassSeries, { type IClassSeries } from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';
import ClassSession, { type IClassSession } from '@/models/class-session';
import User, { type IUser } from '@/models/user';
import { logger } from '@/lib/api/logger';
import { ValidationError } from '@/lib/api/response';
import {
  getGoogleCalendarConnectionStatusForUser,
  getGoogleCalendarRefreshTokenForUser,
} from '@/lib/api/google-calendar-connection';
import { createGoogleCalendarEventWithMeetLink } from '@/lib/api/google-calendar-events';
import {
  applyTutorJoinPolicy,
  getNextSessionForList,
  mapSeriesToListItem,
} from './class.mapper';
import type {
  AdminClassListItemDTO,
  ClassBucket,
  CreateAdminClassBody,
} from './class.api.types';

function validationMessageForGoogleCalendarEventFailure(rawMessage: string): string {
  const m = rawMessage.toLowerCase();
  if (
    m.includes('socket disconnected') ||
    m.includes('tls connection') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('enotfound') ||
    m.includes('network error') ||
    m.includes('fetch failed')
  ) {
    return (
      'Could not reach Google Calendar (network error). Wait a moment and try again. ' +
      'If this keeps happening, ask the tutor to reconnect Google Calendar in Tutor Settings.'
    );
  }
  if (
    m.includes('invalid_grant') ||
    m.includes('invalid authentication') ||
    m.includes('account has been deleted') ||
    m.includes('token has been expired') ||
    m.includes('token expired') ||
    m.includes('revoked') ||
    m.includes('invalid credentials') ||
    m.includes('reauth related error') ||
    m.includes('user needs to reconnect')
  ) {
    return (
      "This tutor's Google Calendar connection is no longer valid. Ask them to open " +
      'Tutor Settings and disconnect and reconnect Google Calendar, then try scheduling again.'
    );
  }
  return (
    'Could not create a Google Meet link for this class. If this keeps happening, ask ' +
    'the tutor to reconnect Google Calendar in Tutor Settings.'
  );
}

export class ClassRepository {
  async create(
    body: CreateAdminClassBody,
    createdBy: Types.ObjectId,
  ): Promise<{ series: IClassSeries; session: IClassSession }> {
    if (!Types.ObjectId.isValid(body.tutorId)) {
      throw new ValidationError('Invalid tutor ID');
    }
    for (const id of body.learnerIds) {
      if (!Types.ObjectId.isValid(id)) {
        throw new ValidationError(`Invalid learner ID: ${id}`);
      }
    }

    const start = new Date(body.firstSessionStart);
    const end = new Date(body.firstSessionEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ValidationError('Invalid session start or end');
    }
    if (end <= start) {
      throw new ValidationError('Session end must be after start');
    }

    const tutor = await User.findById(body.tutorId).select('role email').lean();
    if (!tutor || tutor.role !== 'tutor') {
      throw new ValidationError('Tutor not found or user is not a tutor');
    }

    const googleStatus = await getGoogleCalendarConnectionStatusForUser(
      body.tutorId,
    );
    if (!googleStatus.connected) {
      throw new ValidationError(
        'Tutor must connect Google Calendar before scheduling classes',
      );
    }

    for (const lid of body.learnerIds) {
      const u = await User.findById(lid).select('role').lean();
      if (!u || u.role !== 'user') {
        throw new ValidationError(`Learner ${lid} not found or not a learner (user) role`);
      }
    }

    const recurrence = body.recurrence?.rule ?? 'none';
    const totalPlanned =
      body.totalSessionsPlanned ??
      body.recurrence?.totalSessions ??
      1;

    const title =
      body.title?.trim() ||
      (body.learnerIds.length
        ? `Class (${body.learnerIds.length} learner${body.learnerIds.length > 1 ? 's' : ''})`
        : 'Class');

    const refreshToken = await getGoogleCalendarRefreshTokenForUser(body.tutorId);
    if (!refreshToken) {
      throw new ValidationError(
        'Tutor must reconnect Google Calendar before scheduling classes',
      );
    }

    const learnerEmails = await User.find({
      _id: { $in: body.learnerIds.map((id) => new Types.ObjectId(id)) },
      role: 'user',
    })
      .select('email')
      .lean();

    let meetingUrl: string;
    try {
      const createdCalendarEvent = await createGoogleCalendarEventWithMeetLink({
        refreshToken,
        summary: title,
        description: `Eklana class scheduled by admin.`,
        startIsoUtc: start.toISOString(),
        endIsoUtc: end.toISOString(),
        timezone: body.timezone,
        attendees: [
          tutor.email ?? '',
          ...learnerEmails.map((u) => (typeof u.email === 'string' ? u.email : '')),
        ].filter(Boolean),
      });
      meetingUrl = createdCalendarEvent.meetingUrl;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('ClassRepository.create.googleCalendarEvent', {
        tutorId: body.tutorId,
        message: err.message,
      });
      throw new ValidationError(
        validationMessageForGoogleCalendarEventFailure(err.message ?? ''),
      );
    }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    try {
      const createdSeries = await ClassSeries.create(
        [
          {
            tutorId: new Types.ObjectId(body.tutorId),
            title,
            classType: body.classType,
            timezone: body.timezone,
            totalSessionsPlanned: Math.max(1, totalPlanned),
            scheduleDayLabels: body.scheduleDayLabels ?? [],
            scheduleStartTime: body.scheduleStartTime ?? '',
            scheduleEndTime: body.scheduleEndTime ?? '',
            recurrenceRule: recurrence === 'weekly' ? 'weekly' : 'none',
            createdBy,
            isActive: true,
          },
        ],
        { session: mongoSession },
      );

      const series = createdSeries[0] as unknown as IClassSeries;

      await ClassEnrollment.insertMany(
        body.learnerIds.map((learnerId) => ({
          classSeriesId: series._id,
          learnerId: new Types.ObjectId(learnerId),
          status: 'active' as const,
        })),
        { session: mongoSession },
      );

      const sessionDocId = new Types.ObjectId();

      await ClassSession.create(
        [
          {
            _id: sessionDocId,
            classSeriesId: series._id,
            tutorId: new Types.ObjectId(body.tutorId),
            startUtc: start,
            endUtc: end,
            meetingUrl,
            status: 'scheduled' as const,
            sequenceNumber: 1,
          },
        ],
        { session: mongoSession },
      );

      await mongoSession.commitTransaction();

      const fresh = await ClassSeries.findById(series._id).lean();
      const sFresh = await ClassSession.findById(sessionDocId).lean();
      if (!fresh || !sFresh) {
        throw new ValidationError('Failed to load class after create');
      }

      return {
        series: fresh as unknown as IClassSeries,
        session: sFresh as unknown as IClassSession,
      };
    } catch (e: unknown) {
      await mongoSession.abortTransaction();
      const err = e as Error;
      logger.error('ClassRepository.create', { message: err.message });
      throw e;
    } finally {
      mongoSession.endSession();
    }
  }

  async findById(classSeriesId: string): Promise<{
    series: IClassSeries;
    sessions: IClassSession[];
    learners: IUser[];
    tutor: IUser;
  } | null> {
    if (!Types.ObjectId.isValid(classSeriesId)) {
      return null;
    }
    const series = await ClassSeries.findById(classSeriesId).lean();
    if (!series) return null;

    const [sessions, enrollments, tutor] = await Promise.all([
      ClassSession.find({ classSeriesId: series._id })
        .sort({ startUtc: 1 })
        .lean()
        .exec(),
      ClassEnrollment.find({
        classSeriesId: series._id,
        status: 'active',
      })
        .lean()
        .exec(),
      User.findById(series.tutorId).select('-password').lean().exec(),
    ]);

    if (!tutor) {
      return null;
    }

    const learnerIds = enrollments.map((e) => e.learnerId);
    const learners = await User.find({ _id: { $in: learnerIds } })
      .select('-password')
      .lean()
      .exec();

    return {
      series: series as unknown as IClassSeries,
      sessions: sessions as unknown as IClassSession[],
      learners: learners as unknown as IUser[],
      tutor: tutor as unknown as IUser,
    };
  }

  async findAdminList(params: {
    bucket?: ClassBucket;
    limit: number;
    offset: number;
  }): Promise<{ items: AdminClassListItemDTO[]; total: number }> {
    const query = { isActive: true };
    /** Cap for MVP: map + optional bucket filter before slice (Phase 1). */
    const MAX_SERIES_SCAN = 500;
    const seriesList = await ClassSeries.find(query)
      .sort({ updatedAt: -1 })
      .limit(MAX_SERIES_SCAN)
      .lean()
      .exec();

    if (seriesList.length === 0) {
      return { items: [], total: 0 };
    }

    const ids = seriesList.map((s) => s._id);
    const [allSessions, allEnrollments] = await Promise.all([
      ClassSession.find({ classSeriesId: { $in: ids } })
        .sort({ startUtc: 1 })
        .lean()
        .exec(),
      ClassEnrollment.find({
        classSeriesId: { $in: ids },
        status: 'active',
      })
        .lean()
        .exec(),
    ]);

    const tutorIds = [...new Set(seriesList.map((s) => s.tutorId.toString()))];
    const learnerIds = [
      ...new Set(allEnrollments.map((e) => e.learnerId.toString())),
    ];
    const users = await User.find({
      _id: {
        $in: [
          ...tutorIds.map((id) => new Types.ObjectId(id)),
          ...learnerIds.map((id) => new Types.ObjectId(id)),
        ],
      },
    })
      .select('-password')
      .lean()
      .exec();

    const userMap = new Map(users.map((u) => [u._id.toString(), u as unknown as IUser]));

    const sessionsBySeries = new Map<string, IClassSession[]>();
    for (const s of allSessions) {
      const k = s.classSeriesId.toString();
      if (!sessionsBySeries.has(k)) sessionsBySeries.set(k, []);
      sessionsBySeries.get(k)!.push(s as unknown as IClassSession);
    }

    const enrollmentsBySeries = new Map<string, Types.ObjectId[]>();
    for (const e of allEnrollments) {
      const k = e.classSeriesId.toString();
      if (!enrollmentsBySeries.has(k)) enrollmentsBySeries.set(k, []);
      enrollmentsBySeries.get(k)!.push(e.learnerId as Types.ObjectId);
    }

    const items: AdminClassListItemDTO[] = [];
    for (const ser of seriesList) {
      const sid = ser._id.toString();
      const tutor = userMap.get(ser.tutorId.toString());
      if (!tutor) continue;

      const lids = enrollmentsBySeries.get(sid) ?? [];
      const learnerUsers = lids
        .map((lid) => userMap.get(lid.toString()))
        .filter(Boolean) as IUser[];

      const item = mapSeriesToListItem(
        ser as unknown as IClassSeries,
        sessionsBySeries.get(sid) ?? [],
        learnerUsers,
        tutor,
      );
      if (params.bucket && item.bucket !== params.bucket) {
        continue;
      }
      items.push(item);
    }

    const total = items.length;
    const paged = items.slice(params.offset, params.offset + params.limit);
    return { items: paged, total };
  }

  /**
   * Classes assigned to this tutor only; meetingUrl omitted outside join window.
   */
  async findTutorList(params: {
    tutorId: Types.ObjectId;
    bucket?: ClassBucket;
    limit: number;
    offset: number;
  }): Promise<{ items: AdminClassListItemDTO[]; total: number }> {
    const MAX_SERIES_SCAN = 500;
    const seriesList = await ClassSeries.find({
      isActive: true,
      tutorId: params.tutorId,
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_SERIES_SCAN)
      .lean()
      .exec();

    if (seriesList.length === 0) {
      return { items: [], total: 0 };
    }

    const ids = seriesList.map((s) => s._id);
    const [allSessions, allEnrollments] = await Promise.all([
      ClassSession.find({ classSeriesId: { $in: ids } })
        .sort({ startUtc: 1 })
        .lean()
        .exec(),
      ClassEnrollment.find({
        classSeriesId: { $in: ids },
        status: 'active',
      })
        .lean()
        .exec(),
    ]);

    const tutorIds = [...new Set(seriesList.map((s) => s.tutorId.toString()))];
    const learnerIds = [
      ...new Set(allEnrollments.map((e) => e.learnerId.toString())),
    ];
    const users = await User.find({
      _id: {
        $in: [
          ...tutorIds.map((id) => new Types.ObjectId(id)),
          ...learnerIds.map((id) => new Types.ObjectId(id)),
        ],
      },
    })
      .select('-password')
      .lean()
      .exec();

    const userMap = new Map(users.map((u) => [u._id.toString(), u as unknown as IUser]));

    const sessionsBySeries = new Map<string, IClassSession[]>();
    for (const s of allSessions) {
      const k = s.classSeriesId.toString();
      if (!sessionsBySeries.has(k)) sessionsBySeries.set(k, []);
      sessionsBySeries.get(k)!.push(s as unknown as IClassSession);
    }

    const enrollmentsBySeries = new Map<string, Types.ObjectId[]>();
    for (const e of allEnrollments) {
      const k = e.classSeriesId.toString();
      if (!enrollmentsBySeries.has(k)) enrollmentsBySeries.set(k, []);
      enrollmentsBySeries.get(k)!.push(e.learnerId as Types.ObjectId);
    }

    const items: AdminClassListItemDTO[] = [];
    for (const ser of seriesList) {
      const sid = ser._id.toString();
      const tutor = userMap.get(ser.tutorId.toString());
      if (!tutor) continue;

      const lids = enrollmentsBySeries.get(sid) ?? [];
      const learnerUsers = lids
        .map((lid) => userMap.get(lid.toString()))
        .filter(Boolean) as IUser[];

      const sess = sessionsBySeries.get(sid) ?? [];
      const next = getNextSessionForList(sess);
      const raw = mapSeriesToListItem(
        ser as unknown as IClassSeries,
        sess,
        learnerUsers,
        tutor,
      );
      const item = applyTutorJoinPolicy(raw, next);
      if (params.bucket && item.bucket !== params.bucket) {
        continue;
      }
      items.push(item);
    }

    const total = items.length;
    const paged = items.slice(params.offset, params.offset + params.limit);
    return { items: paged, total };
  }

  /**
   * Classes the learner is enrolled in (active enrollment + active series).
   */
  async findLearnerList(params: {
    learnerId: Types.ObjectId;
    bucket?: ClassBucket;
    limit: number;
    offset: number;
  }): Promise<{ items: AdminClassListItemDTO[]; total: number }> {
    const MAX_SERIES_SCAN = 500;
    const enrollRows = await ClassEnrollment.find({
      learnerId: params.learnerId,
      status: 'active',
    })
      .lean()
      .exec();

    if (enrollRows.length === 0) {
      return { items: [], total: 0 };
    }

    const seriesIdStrings = [
      ...new Set(enrollRows.map((e) => e.classSeriesId.toString())),
    ];
    const seriesList = await ClassSeries.find({
      _id: { $in: seriesIdStrings.map((id) => new Types.ObjectId(id)) },
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_SERIES_SCAN)
      .lean()
      .exec();

    if (seriesList.length === 0) {
      return { items: [], total: 0 };
    }

    const ids = seriesList.map((s) => s._id);
    const [allSessions, allEnrollments] = await Promise.all([
      ClassSession.find({ classSeriesId: { $in: ids } })
        .sort({ startUtc: 1 })
        .lean()
        .exec(),
      ClassEnrollment.find({
        classSeriesId: { $in: ids },
        status: 'active',
      })
        .lean()
        .exec(),
    ]);

    const tutorIds = [...new Set(seriesList.map((s) => s.tutorId.toString()))];
    const learnerIds = [
      ...new Set(allEnrollments.map((e) => e.learnerId.toString())),
    ];
    const users = await User.find({
      _id: {
        $in: [
          ...tutorIds.map((id) => new Types.ObjectId(id)),
          ...learnerIds.map((id) => new Types.ObjectId(id)),
        ],
      },
    })
      .select('-password')
      .lean()
      .exec();

    const userMap = new Map(users.map((u) => [u._id.toString(), u as unknown as IUser]));

    const sessionsBySeries = new Map<string, IClassSession[]>();
    for (const s of allSessions) {
      const k = s.classSeriesId.toString();
      if (!sessionsBySeries.has(k)) sessionsBySeries.set(k, []);
      sessionsBySeries.get(k)!.push(s as unknown as IClassSession);
    }

    const enrollmentsBySeries = new Map<string, Types.ObjectId[]>();
    for (const e of allEnrollments) {
      const k = e.classSeriesId.toString();
      if (!enrollmentsBySeries.has(k)) enrollmentsBySeries.set(k, []);
      enrollmentsBySeries.get(k)!.push(e.learnerId as Types.ObjectId);
    }

    const items: AdminClassListItemDTO[] = [];
    for (const ser of seriesList) {
      const sid = ser._id.toString();
      const tutor = userMap.get(ser.tutorId.toString());
      if (!tutor) continue;

      const lids = enrollmentsBySeries.get(sid) ?? [];
      const learnerUsers = lids
        .map((lid) => userMap.get(lid.toString()))
        .filter(Boolean) as IUser[];

      const sess = sessionsBySeries.get(sid) ?? [];
      const next = getNextSessionForList(sess);
      const raw = mapSeriesToListItem(
        ser as unknown as IClassSeries,
        sess,
        learnerUsers,
        tutor,
      );
      const item = applyTutorJoinPolicy(raw, next);
      if (params.bucket && item.bucket !== params.bucket) {
        continue;
      }
      items.push(item);
    }

    const total = items.length;
    const paged = items.slice(params.offset, params.offset + params.limit);
    return { items: paged, total };
  }

  /** Single session for learner join / deep link; null if not enrolled or missing. */
  async findSessionForLearner(
    sessionId: string,
    learnerId: Types.ObjectId,
  ): Promise<{
    session: IClassSession;
    seriesTitle: string;
    tutorName: string;
    tutorId: Types.ObjectId;
  } | null> {
    if (!Types.ObjectId.isValid(sessionId)) {
      return null;
    }
    const session = await ClassSession.findById(sessionId).lean();
    if (!session) return null;

    const series = await ClassSeries.findById(session.classSeriesId).lean();
    if (!series || !series.isActive) return null;

    const enr = await ClassEnrollment.findOne({
      classSeriesId: series._id,
      learnerId,
      status: 'active',
    }).lean();
    if (!enr) return null;

    const tutor = await User.findById(series.tutorId)
      .select('firstName lastName email')
      .lean();
    if (!tutor) return null;

    const n = `${tutor.firstName ?? ''} ${tutor.lastName ?? ''}`.trim();
    const tutorName = n || tutor.email || 'Tutor';

    return {
      session: session as unknown as IClassSession,
      seriesTitle: series.title || 'Class',
      tutorName,
      tutorId: series.tutorId as Types.ObjectId,
    };
  }

  /** Soft-delete: hide series from lists (admin/tutor). */
  async softDeleteSeries(classSeriesId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(classSeriesId)) {
      throw new ValidationError('Invalid class ID');
    }
    const updated = await ClassSeries.findOneAndUpdate(
      { _id: classSeriesId, isActive: true },
      { $set: { isActive: false } },
      { new: true },
    )
      .lean()
      .exec();
    return !!updated;
  }
}
