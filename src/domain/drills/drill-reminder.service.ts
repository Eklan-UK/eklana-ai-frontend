import User from '@/models/user';
import DrillAssignment from '@/models/drill-assignment';
import Profile from '@/models/profile';
import UserStreak from '@/models/user-streak';
import DailyPracticeReminderDispatch from '@/models/daily-practice-reminder-dispatch';
import { StreakService } from '@/services/streak.service';
import {
  onDailyPracticeNudge,
  onStreakReminder,
} from '@/services/notification/triggers';
import { logger } from '@/lib/api/logger';
import { toUserIdCandidates } from '@/lib/api/user-id';
import { zonedDateKey } from '@/domain/tutor-availability/availability-window';
import {
  hasQualifyingDrillTodayLocal,
  isLocalHour18,
} from '@/lib/timezone/drill-practice-day';

export type DrillReminderVariant = 'daily' | 'streak';

export type SendForLearnerResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  pendingCount?: number;
  streakDays?: number;
  delivery?: unknown;
};

export type DailyPracticeReminderDebugEntry = {
  learnerId: string;
  reason:
    | 'not_local_hour'
    | 'already_dispatched'
    | 'prefs_disabled'
    | 'already_practiced'
    | 'sent'
    | 'delivery_failed';
  localDateKey?: string;
  timeZone?: string;
  pendingCount?: number;
};

const LEARNER_BATCH_SIZE = 500;
const DEFAULT_TIMEZONE = 'UTC';

export class DrillReminderService {
  /**
   * Hourly cron: send a 6 PM local-time practice nudge to active learners who
   * have not completed a qualifying drill (score >= 70) that local calendar day.
   */
  async runDailyReminders(
    now: Date = new Date(),
    options?: {
      debug?: boolean;
      learnerId?: string;
      timezoneOverride?: string;
    },
  ): Promise<{
    examined: number;
    sent: number;
    skipped: number;
    errors: string[];
    debug?: DailyPracticeReminderDebugEntry[];
  }> {
    let examined = 0;
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];
    const debug: DailyPracticeReminderDebugEntry[] = [];
    const includeDebug = options?.debug === true;

    const learnerFilter: Record<string, unknown> = {
      role: { $in: ['user', 'learner'] },
      isDeleted: { $ne: true },
    };
    if (options?.learnerId) {
      learnerFilter._id = options.learnerId;
    }

    const totalLearners = await User.countDocuments(learnerFilter);
    logger.info('[DrillReminderService] runDailyReminders start', {
      activeLearners: totalLearners,
      learnerId: options?.learnerId,
      timezoneOverride: options?.timezoneOverride,
    });

    for (let skip = 0; skip < totalLearners; skip += LEARNER_BATCH_SIZE) {
      const learners = await User.find(learnerFilter)
        .select('_id')
        .skip(skip)
        .limit(LEARNER_BATCH_SIZE)
        .lean();

      for (const learner of learners) {
        const learnerId = String(learner._id);
        examined += 1;

        try {
          const profile = await Profile.findOne({ userId: learnerId })
            .select('notificationPreferences timezone')
            .lean();

          const timeZone =
            options?.timezoneOverride?.trim() ||
            profile?.timezone?.trim() ||
            DEFAULT_TIMEZONE;

          if (!isLocalHour18(now, timeZone)) {
            skipped += 1;
            if (includeDebug) {
              debug.push({
                learnerId,
                reason: 'not_local_hour',
                timeZone,
              });
            }
            continue;
          }

          const localDateKey = zonedDateKey(now, timeZone);

          const alreadySent = await DailyPracticeReminderDispatch.findOne({
            learnerId: { $in: toUserIdCandidates(learnerId) },
            localDateKey,
          }).lean();
          if (alreadySent) {
            skipped += 1;
            if (includeDebug) {
              debug.push({
                learnerId,
                reason: 'already_dispatched',
                localDateKey,
                timeZone,
              });
            }
            continue;
          }

          if (profile?.notificationPreferences?.learningReminders === false) {
            skipped += 1;
            if (includeDebug) {
              debug.push({
                learnerId,
                reason: 'prefs_disabled',
                localDateKey,
                timeZone,
              });
            }
            continue;
          }

          const practiced = await hasQualifyingDrillTodayLocal(
            learnerId,
            timeZone,
            now,
          );
          if (practiced) {
            skipped += 1;
            if (includeDebug) {
              debug.push({
                learnerId,
                reason: 'already_practiced',
                localDateKey,
                timeZone,
              });
            }
            continue;
          }

          const pendingCount = await DrillAssignment.countDocuments({
            learnerId,
            status: { $in: ['pending', 'in-progress'] },
          });

          let streakDays = 0;
          try {
            const streakData = await StreakService.getStreakData(learnerId);
            streakDays = streakData.currentStreak;
          } catch {
            // streak is non-critical — proceed with 0
          }

          const result = await onDailyPracticeNudge(learnerId, {
            pendingCount,
            streakDays,
          });

          if (!result) {
            skipped += 1;
            if (includeDebug) {
              debug.push({
                learnerId,
                reason: 'delivery_failed',
                localDateKey,
                timeZone,
                pendingCount,
              });
            }
            continue;
          }

          sent += 1;
          try {
            await DailyPracticeReminderDispatch.create({
              learnerId,
              localDateKey,
              timeZone,
              sentAt: now,
              channels: { push: Boolean(result.pushDelivered) },
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('duplicate key') && !msg.includes('E11000')) {
              logger.warn('DailyPracticeReminderDispatch.create failed', {
                learnerId,
                msg,
              });
            }
          }

          if (includeDebug) {
            debug.push({
              learnerId,
              reason: 'sent',
              localDateKey,
              timeZone,
              pendingCount,
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${learnerId}: ${msg}`);
          logger.error('[DrillReminderService] error for learner', {
            learnerId,
            error: msg,
          });
        }
      }
    }

    logger.info('[DrillReminderService] runDailyReminders done', {
      examined,
      sent,
      skipped,
      errorCount: errors.length,
    });

    return {
      examined,
      sent,
      skipped,
      errors,
      ...(includeDebug ? { debug } : {}),
    };
  }

  /**
   * Rolling reminder: send a streak nudge to every learner whose last qualifying drill
   * was completed 23.5–24.5 hours ago, ensuring at most one reminder per 23-hour window.
   *
   * This should be triggered by a cron running every 30 minutes so the 1-hour window
   * is never missed. The lastReminderSentAt guard prevents duplicates even when the
   * cron fires multiple times inside the window.
   */
  async runRollingReminders(): Promise<{
    examined: number;
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    let examined = 0;
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    const now = new Date();
    const windowEnd = new Date(now.getTime() - 23.5 * 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() - 24.5 * 60 * 60 * 1000);
    const dedupeThreshold = new Date(now.getTime() - 23 * 60 * 60 * 1000);

    const candidates = await UserStreak.find({
      lastDrillCompletedAt: { $gte: windowStart, $lte: windowEnd },
      $or: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { $lt: dedupeThreshold } },
      ],
    })
      .select('userId currentStreak lastReminderSentAt')
      .lean()
      .exec();

    logger.info('[DrillReminderService] runRollingReminders start', {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      candidates: candidates.length,
    });

    for (const doc of candidates) {
      const learnerId = String(doc.userId);
      examined += 1;

      try {
        const profile = await Profile.findOne({ userId: learnerId })
          .select('notificationPreferences')
          .lean();

        if (profile?.notificationPreferences?.learningReminders === false) {
          skipped += 1;
          continue;
        }

        const streakData = await StreakService.getStreakData(learnerId);
        const streakDays = streakData.currentStreak;

        if (streakDays <= 0) {
          skipped += 1;
          continue;
        }

        const result = await onStreakReminder(learnerId, streakDays);

        if (result) {
          await UserStreak.updateOne(
            { userId: doc.userId },
            { $set: { lastReminderSentAt: now } }
          ).exec();
          sent += 1;
        } else {
          skipped += 1;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${learnerId}: ${msg}`);
        logger.error('[DrillReminderService] runRollingReminders error for learner', {
          learnerId,
          error: msg,
        });
      }
    }

    logger.info('[DrillReminderService] runRollingReminders done', {
      examined,
      sent,
      skipped,
      errorCount: errors.length,
    });

    return { examined, sent, skipped, errors };
  }

  /**
   * Send a single reminder to one learner (dev/test — no cron window or dedupe).
   */
  async sendForLearner(
    learnerId: string,
    variant: DrillReminderVariant,
  ): Promise<SendForLearnerResult> {
    const profile = await Profile.findOne({ userId: learnerId })
      .select('notificationPreferences')
      .lean();

    if (profile?.notificationPreferences?.learningReminders === false) {
      return {
        sent: false,
        skipped: true,
        reason: 'learning_reminders_disabled',
      };
    }

    if (variant === 'daily') {
      const pendingCount = await DrillAssignment.countDocuments({
        learnerId,
        status: { $in: ['pending', 'in-progress'] },
      });

      let streakDays = 0;
      try {
        const streakData = await StreakService.getStreakData(learnerId);
        streakDays = streakData.currentStreak;
      } catch {
        // streak is non-critical — proceed with 0
      }

      const result = await onDailyPracticeNudge(learnerId, {
        pendingCount,
        streakDays,
      });

      if (!result) {
        return {
          sent: false,
          skipped: true,
          reason: 'delivery_failed',
          pendingCount,
          streakDays,
        };
      }

      return {
        sent: true,
        skipped: false,
        pendingCount,
        streakDays,
        delivery: result,
      };
    }

    const streakData = await StreakService.getStreakData(learnerId);
    const streakDays = streakData.currentStreak;

    if (streakDays <= 0) {
      return {
        sent: false,
        skipped: true,
        reason: 'streak_zero',
        streakDays,
      };
    }

    const result = await onStreakReminder(learnerId, streakDays);

    if (!result) {
      return {
        sent: false,
        skipped: true,
        reason: 'delivery_failed',
        streakDays,
      };
    }

    return {
      sent: true,
      skipped: false,
      streakDays,
      delivery: result,
    };
  }
}
