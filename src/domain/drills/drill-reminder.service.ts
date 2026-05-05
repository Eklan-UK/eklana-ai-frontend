import FCMToken from '@/models/fcm-token';
import DrillAssignment from '@/models/drill-assignment';
import Profile from '@/models/profile';
import { StreakService } from '@/services/streak.service';
import { onDrillPracticeReminder } from '@/services/notification/triggers';
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
    const learnerIds: string[] = await FCMToken.distinct('userId', { isActive: true });

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
          const streakData = await StreakService.getStreakData(learnerId.toString());
          streakDays = streakData.currentStreak;
        } catch {
          // streak is non-critical — proceed with 0
        }

        const result = await onDrillPracticeReminder(
          learnerId.toString(),
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
}
