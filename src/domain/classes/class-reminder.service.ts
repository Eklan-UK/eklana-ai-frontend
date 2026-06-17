import ClassSession from '@/models/class-session';
import ClassSeries from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';
import SessionReminderDispatch from '@/models/session-reminder-dispatch';
import FCMToken from '@/models/fcm-token';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import {
  sendNotificationToUser,
  NotificationType,
} from '@/lib/fcm-trigger';
import { sendClassReminderEmail } from '@/lib/api/email.service';

/** Maximum reminder offset supported (minutes). Sessions starting further out are ignored. */
const MAX_REMINDER_MINUTES = 120;

/** Tolerance window around a scheduled reminder time (±1 minute). */
const TOLERANCE_MS = 60 * 1000;

function reminderTitle(minutesBefore: number): string {
  if (minutesBefore === 60) return 'Class starts in 1 hour';
  return `Class starts in ${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}`;
}

export class ClassReminderService {
  /**
   * Called every minute by the cron route.
   * Finds sessions whose start time matches any per-series configured reminder
   * offset (within ±1 min of now + offset) and sends FCM + email once per
   * session/offset pair (deduped via SessionReminderDispatch).
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

    const nowMs = now.getTime();

    // Fetch all scheduled sessions starting within the next MAX_REMINDER_MINUTES + 1 min.
    // This is the broadest window we ever need to check.
    const windowEnd = new Date(nowMs + (MAX_REMINDER_MINUTES + 1) * 60 * 1000);
    const windowStart = new Date(nowMs + TOLERANCE_MS); // at least 1 min from now

    const sessions = await ClassSession.find({
      status: 'scheduled',
      startUtc: { $gte: windowStart, $lte: windowEnd },
    })
      .lean()
      .exec();

    for (const session of sessions) {
      examined += 1;

      const series = await ClassSeries.findById(session.classSeriesId).lean();
      if (!series?.isActive) continue;
      if (!series.remindersEnabled) continue;

      const reminderMinutes: number[] =
        Array.isArray(series.reminderMinutes) && series.reminderMinutes.length > 0
          ? series.reminderMinutes
          : [10, 30];

      const msUntilStart = new Date(session.startUtc).getTime() - nowMs;

      for (const m of reminderMinutes) {
        const targetMs = m * 60 * 1000;
        const diff = Math.abs(msUntilStart - targetMs);
        if (diff > TOLERANCE_MS) continue;

        const kind = String(m);

        const alreadySent = await SessionReminderDispatch.findOne({
          sessionId: session._id,
          kind,
        }).lean();
        if (alreadySent) {
          skipped += 1;
          continue;
        }

        const enrollments = await ClassEnrollment.find({
          classSeriesId: session.classSeriesId,
          status: 'active',
        }).lean();

        const seriesTitle = series.title?.trim() || 'Your class';
        let anySent = false;

        for (const enrollment of enrollments) {
          const learnerId = enrollment.learnerId.toString();

          // --- FCM push ---
          const tokens = await FCMToken.find({
            userId: enrollment.learnerId,
            isActive: true,
          })
            .select('token')
            .lean();

          for (const tok of tokens) {
            try {
              await sendNotificationToUser(learnerId, tok.token, {
                type: NotificationType.CLASS_SESSION_REMINDER,
                title: reminderTitle(m),
                body: `${seriesTitle} — tap to open your schedule.`,
                actionUrl: '/account/classes',
                data: {
                  sessionId: session._id.toString(),
                  classSeriesId: session.classSeriesId.toString(),
                  reminderKind: kind,
                },
              });
              anySent = true;
              sent += 1;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`${session._id}/${kind}/${learnerId}/fcm: ${msg}`);
              logger.warn('Class reminder FCM failed', {
                sessionId: session._id,
                kind,
                learnerId,
                msg,
              });
            }
          }

          // --- Email ---
          const learner = await User.findById(enrollment.learnerId)
            .select('email firstName lastName name')
            .lean();
          if (learner?.email) {
            const name =
              `${(learner as { firstName?: string }).firstName ?? ''} ${(learner as { lastName?: string }).lastName ?? ''}`.trim() ||
              (learner as { name?: string }).name ||
              'Student';
            try {
              await sendClassReminderEmail({
                studentEmail: learner.email as string,
                studentName: name,
                classTitle: seriesTitle,
                minutesBefore: m,
                sessionStart: new Date(session.startUtc),
                meetingUrl: session.meetingUrl,
              });
              anySent = true;
              sent += 1;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`${session._id}/${kind}/${learnerId}/email: ${msg}`);
              logger.warn('Class reminder email failed', {
                sessionId: session._id,
                kind,
                learnerId,
                msg,
              });
            }
          }
        }

        // Record dispatch so this session/kind pair is never re-sent.
        if (enrollments.length === 0 || anySent) {
          try {
            await SessionReminderDispatch.create({
              sessionId: session._id,
              kind,
              sentAt: new Date(),
            });
          } catch (err: unknown) {
            // Unique index violation means a concurrent cron run already saved it — fine.
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('duplicate key') && !msg.includes('E11000')) {
              logger.warn('SessionReminderDispatch.create failed', { msg });
            }
          }
        }
      }
    }

    return { examined, sent, skipped, errors };
  }
}
