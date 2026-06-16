import FCMToken from '@/models/fcm-token';
import DrillAssignment from '@/models/drill-assignment';
import Profile from '@/models/profile';
import UserStreak from '@/models/user-streak';
import { StreakService } from '@/services/streak.service';
import { onDrillPracticeReminder, onStreakReminder } from '@/services/notification/triggers';
import { logger } from '@/lib/api/logger';

export class DrillReminderService {
  /**
   * Send a daily practice reminder to every learner who has active FCM tokens.
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

    // Collect unique learner IDs that have at least one active FCM token
    const learnerIds = (await FCMToken.distinct('userId', { isActive: true })).map((id) =>
      String(id),
    );

    logger.info('[DrillReminderService] runDailyReminders start', {
      learnersWithTokens: learnerIds.length,
    });

    for (const learnerId of learnerIds) {
      examined += 1;
      try {
        // Respect notification preference
        const profile = await Profile.findOne({ userId: learnerId })
          .select('notificationPreferences')
          .lean();

        if (profile?.notificationPreferences?.learningReminders === false) {
          skipped += 1;
          continue;
        }

        // Count incomplete drills
        const pendingCount = await DrillAssignment.countDocuments({
          learnerId,
          status: { $in: ['pending', 'in-progress'] },
        });

        // Get current streak (falls back to 0 on error or disabled)
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
      } catch (err: any) {
        const msg = err?.message ?? String(err);
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
        // Respect notification preference
        const profile = await Profile.findOne({ userId: learnerId })
          .select('notificationPreferences')
          .lean();

        if (profile?.notificationPreferences?.learningReminders === false) {
          skipped += 1;
          continue;
        }

        const result = await onStreakReminder(learnerId, doc.currentStreak ?? 0);

        if (result) {
          await UserStreak.updateOne(
            { userId: doc.userId },
            { $set: { lastReminderSentAt: now } }
          ).exec();
          sent += 1;
        } else {
          skipped += 1;
        }
      } catch (err: any) {
        const msg = err?.message ?? String(err);
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
}
