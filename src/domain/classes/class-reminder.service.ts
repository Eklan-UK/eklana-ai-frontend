import ClassSession from '@/models/class-session';
import ClassSeries from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';
import SessionReminderDispatch from '@/models/session-reminder-dispatch';
import FCMToken from '@/models/fcm-token';
import { logger } from '@/lib/api/logger';
import {
  sendNotificationToUser,
  NotificationType,
} from '@/lib/fcm-trigger';

type ReminderKind = '60' | '10';

const WINDOWS: {
  kind: ReminderKind;
  minBeforeStartMs: number;
  maxBeforeStartMs: number;
}[] = [
  { kind: '60', minBeforeStartMs: 59 * 60 * 1000, maxBeforeStartMs: 61 * 60 * 1000 },
  { kind: '10', minBeforeStartMs: 9 * 60 * 1000, maxBeforeStartMs: 11 * 60 * 1000 },
];

export class ClassReminderService {
  /**
   * Find sessions whose start falls in the "about T+X from now" window and send FCM once per kind.
   */
  async runDueReminders(now: Date = new Date()): Promise<{
    examined: number;
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let sent = 0;
    let skipped = 0;
    let examined = 0;

    const t = now.getTime();

    for (const w of WINDOWS) {
      const winStart = new Date(t + w.minBeforeStartMs);
      const winEnd = new Date(t + w.maxBeforeStartMs);

      const sessions = await ClassSession.find({
        status: 'scheduled',
        startUtc: { $gte: winStart, $lte: winEnd },
      })
        .lean()
        .exec();

      for (const session of sessions) {
        examined += 1;
        const exists = await SessionReminderDispatch.findOne({
          sessionId: session._id,
          kind: w.kind,
        }).lean();
        if (exists) {
          skipped += 1;
          continue;
        }

        const series = await ClassSeries.findById(session.classSeriesId).lean();
        if (!series?.isActive) continue;

        const seriesTitle = series.title?.trim() || 'Your class';

        const enrollments = await ClassEnrollment.find({
          classSeriesId: session.classSeriesId,
          status: 'active',
        }).lean();

        let anySent = false;
        for (const e of enrollments) {
          const learnerId = e.learnerId.toString();
          const tokens = await FCMToken.find({
            userId: e.learnerId,
            isActive: true,
          })
            .select('token')
            .lean();

          for (const tok of tokens) {
            try {
              await sendNotificationToUser(learnerId, tok.token, {
                type: NotificationType.CLASS_SESSION_REMINDER,
                title:
                  w.kind === '60'
                    ? 'Class starts in about 1 hour'
                    : 'Class starts in about 10 minutes',
                body: `${seriesTitle} — tap to open your schedule.`,
                actionUrl: '/account/classes',
                data: {
                  sessionId: session._id.toString(),
                  classSeriesId: session.classSeriesId.toString(),
                  reminderKind: w.kind,
                },
              });
              anySent = true;
              sent += 1;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`${session._id}/${w.kind}/${learnerId}: ${msg}`);
              logger.warn('Class reminder FCM failed', { sessionId: session._id, kind: w.kind, msg });
            }
          }
        }

        if (enrollments.length === 0) {
          await SessionReminderDispatch.create({
            sessionId: session._id,
            kind: w.kind,
            sentAt: new Date(),
          });
        } else if (anySent) {
          await SessionReminderDispatch.create({
            sessionId: session._id,
            kind: w.kind,
            sentAt: new Date(),
          });
        }
      }
    }

    return { examined, sent, skipped, errors };
  }
}
