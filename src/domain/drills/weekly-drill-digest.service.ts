import DrillAssignment from '@/models/drill-assignment';
import Drill from '@/models/drill';
import Profile from '@/models/profile';
import User from '@/models/user';
import WeeklyDrillDigestDispatch from '@/models/weekly-drill-digest-dispatch';
import { logger } from '@/lib/api/logger';
import { sendWeeklyDrillDigestEmail } from '@/lib/api/email.service';
import { formatDrillNotificationLabel } from '@/lib/drill-display-label';
import { onWeeklyDrillDigest } from '@/services/notification/triggers';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['pending', 'in-progress', 'completed'] as const;

/** Monday 00:00 UTC through Sunday 23:59:59.999 UTC for the week containing `reference`. */
function getIsoWeekBounds(reference = new Date()): { start: Date; end: Date } {
  const d = new Date(reference);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/** ISO week key for dedupe, e.g. `2026-W27`. */
export function getIsoWeekKey(reference = new Date()): string {
  const d = new Date(reference);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function formatWeekLabel(reference = new Date()): string {
  const { start } = getIsoWeekBounds(reference);
  return start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export type WeeklyDrillDigestDebugEntry = {
  learnerId: string;
  reason:
    | 'already_dispatched'
    | 'prefs_disabled'
    | 'no_email'
    | 'sent'
    | 'no_assignments';
  assignmentCount?: number;
  channels?: { email: boolean; push: boolean };
};

type LearnerAssignmentGroup = {
  learnerId: string;
  count: number;
  drillIds: string[];
};

export class WeeklyDrillDigestService {
  /**
   * Monday cron: email + in-app/push digest for learners with new drill assignments
   * in the rolling 7-day window. Deduped per learner per ISO week.
   */
  async runWeeklyDigest(
    now: Date = new Date(),
    options?: { debug?: boolean; learnerId?: string },
  ): Promise<{
    examined: number;
    sent: number;
    skipped: number;
    errors: string[];
    debug?: WeeklyDrillDigestDebugEntry[];
  }> {
    const errors: string[] = [];
    const debug: WeeklyDrillDigestDebugEntry[] = [];
    let sent = 0;
    let skipped = 0;
    let examined = 0;
    const includeDebug = options?.debug === true;
    const weekKey = getIsoWeekKey(now);
    const weekLabel = formatWeekLabel(now);
    const windowStart = new Date(now.getTime() - SEVEN_DAYS_MS);

    const match: Record<string, unknown> = {
      assignedAt: { $gte: windowStart },
      status: { $in: [...ACTIVE_STATUSES] },
    };
    if (options?.learnerId) {
      match.learnerId = options.learnerId;
    }

    const groups = (await DrillAssignment.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$learnerId',
          count: { $sum: 1 },
          drillIds: { $addToSet: '$drillId' },
        },
      },
    ]).exec()) as Array<{ _id: unknown; count: number; drillIds: unknown[] }>;

    const learnerGroups: LearnerAssignmentGroup[] = groups
      .filter((g) => g.count > 0)
      .map((g) => ({
        learnerId: String(g._id),
        count: g.count,
        drillIds: g.drillIds.map((id) => String(id)),
      }));

    logger.info('[WeeklyDrillDigestService] runWeeklyDigest start', {
      weekKey,
      windowStart: windowStart.toISOString(),
      learnerCount: learnerGroups.length,
    });

    for (const group of learnerGroups) {
      examined += 1;
      const { learnerId, count: assignmentCount, drillIds } = group;

      const alreadySent = await WeeklyDrillDigestDispatch.findOne({
        learnerId,
        weekKey,
      }).lean();
      if (alreadySent) {
        skipped += 1;
        if (includeDebug) {
          debug.push({
            learnerId,
            reason: 'already_dispatched',
            assignmentCount,
          });
        }
        continue;
      }

      const profile = await Profile.findOne({ userId: learnerId })
        .select('notificationPreferences')
        .lean();
      if (profile?.notificationPreferences?.learningReminders === false) {
        skipped += 1;
        if (includeDebug) {
          debug.push({
            learnerId,
            reason: 'prefs_disabled',
            assignmentCount,
          });
        }
        continue;
      }

      const drills = await Drill.find({ _id: { $in: drillIds } })
        .select('title type learning_journey_part learning_journey_topic')
        .lean()
        .exec();
      const drillTitles = drills
        .map((d) =>
          formatDrillNotificationLabel({
            title: d.title,
            type: d.type,
            learning_journey_part: d.learning_journey_part,
            learning_journey_topic: d.learning_journey_topic,
          }),
        )
        .slice(0, 20);

      const learner = await User.findById(learnerId)
        .select('email firstName lastName name')
        .lean();

      const studentName =
        `${(learner as { firstName?: string })?.firstName ?? ''} ${(learner as { lastName?: string })?.lastName ?? ''}`.trim() ||
        (learner as { name?: string })?.name ||
        'Student';

      let emailSucceeded = false;
      let pushSucceeded = false;

      if (learner?.email) {
        try {
          await sendWeeklyDrillDigestEmail({
            studentEmail: learner.email as string,
            studentName,
            drillCount: assignmentCount,
            drillTitles,
            weekLabel,
          });
          sent += 1;
          emailSucceeded = true;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${learnerId}/email: ${msg}`);
          logger.warn('Weekly drill digest email failed', { learnerId, msg });
        }
      } else {
        errors.push(`${learnerId}/email: learner has no email`);
        if (includeDebug) {
          debug.push({
            learnerId,
            reason: 'no_email',
            assignmentCount,
          });
        }
      }

      try {
        const pushResult = await onWeeklyDrillDigest(learnerId, {
          drillCount: assignmentCount,
          drillTitles,
          weekKey,
        });
        if (pushResult) {
          sent += 1;
          pushSucceeded = true;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${learnerId}/push: ${msg}`);
        logger.warn('Weekly drill digest push failed', { learnerId, msg });
      }

      if (emailSucceeded || pushSucceeded) {
        try {
          await WeeklyDrillDigestDispatch.create({
            learnerId,
            weekKey,
            sentAt: new Date(),
            assignmentCount,
            channels: { email: emailSucceeded, push: pushSucceeded },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('duplicate key') && !msg.includes('E11000')) {
            logger.warn('WeeklyDrillDigestDispatch.create failed', { msg });
          }
        }

        if (includeDebug) {
          debug.push({
            learnerId,
            reason: 'sent',
            assignmentCount,
            channels: { email: emailSucceeded, push: pushSucceeded },
          });
        }
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
