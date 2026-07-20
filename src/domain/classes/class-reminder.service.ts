import ClassSession from '@/models/class-session';
import ClassSeries from '@/models/class-series';
import ClassEnrollment from '@/models/class-enrollment';
import SessionReminderDispatch from '@/models/session-reminder-dispatch';
import User from '@/models/user';
import Profile from '@/models/profile';
import { logger } from '@/lib/api/logger';
import { sendClassReminderEmail } from '@/lib/api/email.service';
import { buildClassEmailJoinUrl } from '@/lib/api/class-join-token';
import { onClassSessionReminder } from '@/services/notification/triggers';
import { validateTimezone } from '@/lib/timezone/validate-timezone';

/** Maximum reminder offset supported (minutes). Sessions starting further out are ignored. */
const MAX_REMINDER_MINUTES = 120;

/** Fallback timezone when a learner has no valid `Profile.timezone`. */
const DEFAULT_TIMEZONE = 'UTC';

/** Tolerance window around a scheduled reminder time (±1 minute). */
const TOLERANCE_MS = 60 * 1000;

export type ClassReminderDebugEntry = {
  sessionId: string;
  minutesUntilStart: number;
  reminderMinutes: number[];
  reason:
    | 'series_inactive'
    | 'reminders_disabled'
    | 'not_in_reminder_window'
    | 'already_sent'
    | 'no_enrollments'
    | 'sent';
  closestReminderMin?: number;
  closestDiffSeconds?: number;
};

export class ClassReminderService {
  /**
   * Called every minute by the cron route.
   * Finds sessions whose start time matches any per-series configured reminder
   * offset (within ±1 min of now + offset) and sends email + in-app/push once per
   * session/offset pair (deduped via SessionReminderDispatch).
   */
  async runDueReminders(
    now: Date = new Date(),
    options?: { debug?: boolean },
  ): Promise<{
    examined: number;
    sent: number;
    skipped: number;
    errors: string[];
    debug?: ClassReminderDebugEntry[];
  }> {
    const errors: string[] = [];
    const debug: ClassReminderDebugEntry[] = [];
    let sent = 0;
    let skipped = 0;
    let examined = 0;
    const includeDebug = options?.debug === true;

    const nowMs = now.getTime();

    const windowEnd = new Date(nowMs + (MAX_REMINDER_MINUTES + 1) * 60 * 1000);
    const windowStart = new Date(nowMs + TOLERANCE_MS);

    const sessions = await ClassSession.find({
      status: 'scheduled',
      startUtc: { $gte: windowStart, $lte: windowEnd },
    })
      .lean()
      .exec();

    for (const session of sessions) {
      examined += 1;

      const series = await ClassSeries.findById(session.classSeriesId).lean();
      const minutesUntilStart = Math.round(
        (new Date(session.startUtc).getTime() - nowMs) / 60_000,
      );

      if (!series?.isActive) {
        if (includeDebug) {
          debug.push({
            sessionId: session._id.toString(),
            minutesUntilStart,
            reminderMinutes: [],
            reason: 'series_inactive',
          });
        }
        continue;
      }
      if (!series.remindersEnabled) {
        if (includeDebug) {
          debug.push({
            sessionId: session._id.toString(),
            minutesUntilStart,
            reminderMinutes: [],
            reason: 'reminders_disabled',
          });
        }
        continue;
      }

      const reminderMinutes: number[] =
        Array.isArray(series.reminderMinutes) && series.reminderMinutes.length > 0
          ? series.reminderMinutes
          : [10, 30];

      const msUntilStart = new Date(session.startUtc).getTime() - nowMs;

      let matchedReminder = false;
      for (const m of reminderMinutes) {
        const targetMs = m * 60 * 1000;
        const diff = Math.abs(msUntilStart - targetMs);
        if (diff > TOLERANCE_MS) continue;
        matchedReminder = true;

        const kind = String(m);

        const alreadySent = await SessionReminderDispatch.findOne({
          sessionId: session._id,
          kind,
        }).lean();
        if (alreadySent) {
          skipped += 1;
          if (includeDebug) {
            debug.push({
              sessionId: session._id.toString(),
              minutesUntilStart,
              reminderMinutes,
              closestReminderMin: m,
              reason: 'already_sent',
            });
          }
          continue;
        }

        const enrollments = await ClassEnrollment.find({
          classSeriesId: session.classSeriesId,
          status: 'active',
        }).lean();

        const seriesTitle = series.title?.trim() || 'Your class';
        let anySent = false;

        if (enrollments.length === 0 && includeDebug) {
          debug.push({
            sessionId: session._id.toString(),
            minutesUntilStart,
            reminderMinutes,
            closestReminderMin: m,
            reason: 'no_enrollments',
          });
        }

        for (const enrollment of enrollments) {
          const learnerId = enrollment.learnerId.toString();

          const learner = await User.findById(enrollment.learnerId)
            .select('email firstName lastName name')
            .lean();

          // --- Email (unchanged) ---
          if (learner?.email) {
            const name =
              `${(learner as { firstName?: string }).firstName ?? ''} ${(learner as { lastName?: string }).lastName ?? ''}`.trim() ||
              (learner as { name?: string }).name ||
              'Student';
            try {
              const profile = await Profile.findOne({ userId: learnerId })
                .select('timezone')
                .lean();
              const rawTimeZone = profile?.timezone?.trim() || DEFAULT_TIMEZONE;
              const timeZone = validateTimezone(rawTimeZone)
                ? rawTimeZone
                : DEFAULT_TIMEZONE;

              // #region agent log
              fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5c0476'},body:JSON.stringify({sessionId:'5c0476',runId:'pre-fix',hypothesisId:'A',location:'class-reminder.service.ts:tz-resolve',message:'Resolved learner timezone for class reminder email',data:{learnerId,profileFound:Boolean(profile),rawTimeZone:profile?.timezone ?? null,resolvedTimeZone:timeZone,usedDefault:timeZone===DEFAULT_TIMEZONE,sessionStartUtc:new Date(session.startUtc).toISOString()},timestamp:Date.now()})}).catch(()=>{});
              // #endregion

              const emailJoinUrl =
                session.meetingUrl?.trim()
                  ? buildClassEmailJoinUrl({
                      sessionId: session._id.toString(),
                      learnerId,
                      sessionEndUtc: new Date(session.endUtc),
                    })
                  : undefined;
              await sendClassReminderEmail({
                studentEmail: learner.email as string,
                studentName: name,
                classTitle: seriesTitle,
                minutesBefore: m,
                sessionStart: new Date(session.startUtc),
                meetingUrl: session.meetingUrl,
                emailJoinUrl,
                timeZone,
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

          // --- In-app + push (unified + FCM fallback) ---
          try {
            const joinUrl =
              session.meetingUrl?.trim()
                ? buildClassEmailJoinUrl({
                    sessionId: session._id.toString(),
                    learnerId,
                    sessionEndUtc: new Date(session.endUtc),
                  })
                : undefined;

            const pushResult = await onClassSessionReminder(learnerId, {
              sessionId: session._id.toString(),
              seriesTitle,
              minutesBefore: m,
              joinUrl,
            });

            if (pushResult) {
              anySent = true;
              sent += 1;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${session._id}/${kind}/${learnerId}/push: ${msg}`);
            logger.warn('Class reminder push failed', {
              sessionId: session._id,
              kind,
              learnerId,
              msg,
            });
          }
        }

        if (includeDebug && anySent) {
          debug.push({
            sessionId: session._id.toString(),
            minutesUntilStart,
            reminderMinutes,
            closestReminderMin: m,
            reason: 'sent',
          });
        }

        if (enrollments.length === 0 || anySent) {
          try {
            await SessionReminderDispatch.create({
              sessionId: session._id,
              kind,
              sentAt: new Date(),
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('duplicate key') && !msg.includes('E11000')) {
              logger.warn('SessionReminderDispatch.create failed', { msg });
            }
          }
        }
      }

      if (!matchedReminder && includeDebug) {
        const closest = reminderMinutes.reduce(
          (best, m) => {
            const diff = Math.abs(msUntilStart - m * 60_000);
            return diff < best.diff ? { m, diff } : best;
          },
          { m: reminderMinutes[0] ?? 0, diff: Infinity },
        );
        debug.push({
          sessionId: session._id.toString(),
          minutesUntilStart,
          reminderMinutes,
          closestReminderMin: closest.m,
          closestDiffSeconds: Math.round(closest.diff / 1000),
          reason: 'not_in_reminder_window',
        });
      }
    }

    return {
      examined,
      sent,
      skipped,
      errors,
      ...(includeDebug ? { debug } : {}),
    };
  }
}
