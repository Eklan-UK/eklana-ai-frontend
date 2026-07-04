import User from '@/models/user';
import DrillAssignment from '@/models/drill-assignment';
import Profile from '@/models/profile';
import UserStreak from '@/models/user-streak';
import { StreakService } from '@/services/streak.service';
import { onDrillPracticeReminder, onStreakReminder } from '@/services/notification/triggers';
import { logger } from '@/lib/api/logger';

export type DrillReminderVariant = 'daily' | 'streak';

export type SendForLearnerResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  pendingCount?: number;
  streakDays?: number;
  delivery?: unknown;
};

export class DrillReminderService {
  /**
   * Send a daily practice reminder to every active student learner.
   *
   * Two messages:
   *  - pending drills exist  → "Time to practise" with count
   *  - no pending drills     → motivational nudge referencing current streak
   *
   * Learners whose Profile has notificationPreferences.learningReminders === false are skipped.
   */
  async runDailyReminders(): Promise<{
    examined: number;
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    let examined = 0;
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    const learners = await User.find({
      role: { $in: ['user', 'learner'] },
      isDeleted: { $ne: true },
    })
      .select('_id')
      .lean();

    const learnerIds = learners.map((u) => String(u._id));

    logger.info('[DrillReminderService] runDailyReminders start', {
      activeLearners: learnerIds.length,
    });

    for (const learnerId of learnerIds) {
      examined += 1;
      try {
        const profile = await Profile.findOne({ userId: learnerId })
          .select('notificationPreferences')
          .lean();

        if (profile?.notificationPreferences?.learningReminders === false) {
          skipped += 1;
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

        const result = await onDrillPracticeReminder(
          learnerId,
          pendingCount,
          streakDays,
        );

        if (result) {
          sent += 1;
        } else {
          skipped += 1;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${learnerId}: ${msg}`);
        logger.error('[DrillReminderService] error for learner', { learnerId, error: msg });
      }
    }

    logger.info('[DrillReminderService] runDailyReminders done', {
      examined,
      sent,
      skipped,
      errorCount: errors.length,
    });

    return { examined, sent, skipped, errors };
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

      const result = await onDrillPracticeReminder(
        learnerId,
        pendingCount,
        streakDays,
      );

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
