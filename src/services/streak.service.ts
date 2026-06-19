// services/streak.service.ts
import DailyFocusCompletion from '@/models/daily-focus-completion';
import StreakActivityDay from '@/models/streak-activity-day';
import UserStreak from '@/models/user-streak';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';

/** Merged row for streak math (daily focus + login/drill activity days). */
type StreakDayRow = { dateString: string; date: Date; score?: number };

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
  streakStartDate: Date | null;
  todayCompleted: boolean;
  yesterdayCompleted: boolean;
  weeklyActivity: Array<{
    date: string;
    completed: boolean;
    score?: number;
  }>;
  badges: Array<{
    badgeId: string;
    badgeName: string;
    unlockedAt: Date;
    milestone: number;
  }>;
}

// Badge definitions
export const BADGE_DEFINITIONS = [
  {
    badgeId: 'week-warrior',
    badgeName: 'Week Warrior',
    description: 'Complete daily focus for 7 consecutive days',
    milestone: 7,
    icon: '🔥',
    color: 'orange',
  },
  // Future badges can be added here
  // {
  //   badgeId: 'monthly-master',
  //   badgeName: 'Monthly Master',
  //   description: 'Complete daily focus for 30 consecutive days',
  //   milestone: 30,
  //   icon: '⭐',
  //   color: 'gold',
  // },
];

export class StreakService {
  /** Streaks run unless `STREAK_ENABLED=false` in environment. */
  private static streakFeatureEnabled(): boolean {
    return process.env.STREAK_ENABLED !== 'false';
  }

  /**
   * Get normalized date string (YYYY-MM-DD) for a given date in UTC
   */
  private static getDateString(date: Date): string {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }

  /**
   * Get today's date string (UTC)
   */
  private static getTodayString(): string {
    return this.getDateString(new Date());
  }

  /**
   * Get yesterday's date string (UTC)
   */
  private static getYesterdayString(): string {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    return this.getDateString(yesterday);
  }

  /**
   * Record a daily focus completion (only if score >= 70%)
   * Called when user completes a daily focus with passing score
   */
  static async recordCompletion(
    userId: string,
    dailyFocusId: string,
    score: number,
    correctAnswers: number,
    totalQuestions: number,
    timeSpent: number = 0,
    answers?: any[]
  ): Promise<{ streakUpdated: boolean; badgeUnlocked: Badge | null }> {
    if (!this.streakFeatureEnabled()) {
      return { streakUpdated: false, badgeUnlocked: null };
    }

    try {
      // Only record if score >= 70%
      if (score < 70) {
        throw new Error('Score must be at least 70% to count toward streak');
      }

      const todayString = this.getTodayString();
      const today = new Date(todayString);
      today.setUTCHours(0, 0, 0, 0);

      // Check if user already completed this daily focus today
      const existingCompletion = await DailyFocusCompletion.findOne({
        userId: new Types.ObjectId(userId),
        dailyFocusId: new Types.ObjectId(dailyFocusId),
        dateString: todayString,
        isFirstCompletion: true,
      }).lean().exec();

      // If already completed, don't count again
      if (existingCompletion) {
        logger.info('User already completed this daily focus today', {
          userId,
          dailyFocusId,
          dateString: todayString,
        });
        return { streakUpdated: false, badgeUnlocked: null };
      }

      // Create completion record (first completion)
      await DailyFocusCompletion.create({
        userId: new Types.ObjectId(userId),
        dailyFocusId: new Types.ObjectId(dailyFocusId),
        date: today,
        dateString: todayString,
        score,
        correctAnswers,
        totalQuestions,
        timeSpent,
        answers: answers || [],
        isFirstCompletion: true,
        completedAt: new Date(),
      });

      // Update streak
      const streakUpdated = await this.updateStreak(userId);

      // Check for badge unlock
      const badgeUnlocked = await this.checkBadgeUnlock(userId);

      logger.info('Daily focus completion recorded', {
        userId,
        dailyFocusId,
        dateString: todayString,
        score,
        streakUpdated,
        badgeUnlocked: badgeUnlocked?.badgeId || null,
      });

      return { streakUpdated, badgeUnlocked };
    } catch (error: any) {
      logger.error('Error recording daily focus completion', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Record a qualifying UTC day from login or drill (idempotent per user+day).
   */
  static async recordActivityDay(
    userId: string,
    opts?: { score?: number }
  ): Promise<{ streakUpdated: boolean }> {
    if (!this.streakFeatureEnabled()) {
      return { streakUpdated: false };
    }
    try {
      const todayString = this.getTodayString();
      const today = new Date(`${todayString}T00:00:00.000Z`);
      const uid = new Types.ObjectId(userId);

      const update: Record<string, unknown> = {
        $set: { date: today },
        $setOnInsert: {
          userId: uid,
          dateString: todayString,
        },
      };
      if (opts?.score != null) {
        update.$max = { score: opts.score };
      }

      await StreakActivityDay.updateOne(
        { userId: uid, dateString: todayString },
        update,
        { upsert: true }
      ).exec();

      const streakUpdated = await this.updateStreak(userId);
      return { streakUpdated };
    } catch (error: any) {
      logger.error('Error recording streak activity day', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Merge daily-focus first completions with streak activity days (UTC).
   */
  private static async getMergedStreakDayRows(
    userId: string
  ): Promise<StreakDayRow[]> {
    const uid = new Types.ObjectId(userId);
    const [dfRows, actRows] = await Promise.all([
      DailyFocusCompletion.find({
        userId: uid,
        isFirstCompletion: true,
      })
        .sort({ date: -1 })
        .limit(400)
        .lean()
        .exec(),
      StreakActivityDay.find({ userId: uid })
        .sort({ dateString: -1 })
        .limit(400)
        .lean()
        .exec(),
    ]);

    const map = new Map<string, StreakDayRow>();

    for (const r of dfRows as any[]) {
      map.set(r.dateString, {
        dateString: r.dateString,
        date: new Date(r.date),
        score: r.score,
      });
    }
    for (const r of actRows as any[]) {
      if (!map.has(r.dateString)) {
        map.set(r.dateString, {
          dateString: r.dateString,
          date: new Date(r.date),
          score: r.score,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }

  /**
   * Update user's streak based on completions
   */
  private static async updateStreak(userId: string): Promise<boolean> {
    try {
      const completions = await this.getMergedStreakDayRows(userId);

      if (completions.length === 0) {
        // No completions, reset streak
        await UserStreak.findOneAndUpdate(
          { userId: new Types.ObjectId(userId) },
          {
            $set: {
              currentStreak: 0,
              streakStartDate: null,
              lastActivityDate: null,
            },
          },
          { upsert: true, new: true }
        ).exec();
        return false;
      }

      const todayString = this.getTodayString();
      const yesterdayString = this.getYesterdayString();

      // Calculate current streak
      let currentStreak = 0;
      let streakStartDate: Date | null = null;
      let expectedDate = new Date(todayString);
      expectedDate.setUTCHours(0, 0, 0, 0);

      // Check if today has completion
      const todayCompletion = completions.find(c => c.dateString === todayString);
      if (todayCompletion) {
        currentStreak = 1;
        streakStartDate = todayCompletion.date;
        expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
      } else {
        // Check yesterday
        const yesterdayCompletion = completions.find(c => c.dateString === yesterdayString);
        if (yesterdayCompletion) {
          currentStreak = 1;
          streakStartDate = yesterdayCompletion.date;
          expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
        } else {
          // No recent activity, streak is 0
          await UserStreak.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            {
              $set: {
                currentStreak: 0,
                streakStartDate: null,
                lastActivityDate: completions[0]?.date || null,
              },
            },
            { upsert: true, new: true }
          ).exec();
          return false;
        }
      }

      // Continue counting backwards
      const completionMap = new Map(completions.map(c => [c.dateString, c]));

      while (true) {
        const expectedDateString = this.getDateString(expectedDate);
        const completion = completionMap.get(expectedDateString);

        if (completion) {
          currentStreak++;
          if (!streakStartDate) {
            streakStartDate = completion.date;
          }
          expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
        } else {
          // Gap found, streak broken
          break;
        }
      }

      // Calculate longest streak
      const longestStreak = this.calculateLongestStreak(completions);

      // Get or create user streak record
      const userStreak = await UserStreak.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            currentStreak,
            streakStartDate,
            lastActivityDate: completions[0]?.date || null,
            longestStreak: Math.max(longestStreak, currentStreak), // Update if current is higher
          },
        },
        { upsert: true, new: true }
      ).exec();

      // Update weekly activity
      const weeklyActivity = this.getWeeklyActivity(completions);
      await UserStreak.findByIdAndUpdate(userStreak._id, {
        $set: { weeklyActivity },
      }).exec();

      return true;
    } catch (error: any) {
      logger.error('Error updating streak', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate longest streak from completions
   */
  private static calculateLongestStreak(completions: any[]): number {
    if (completions.length === 0) return 0;

    let longestStreak = 0;
    let currentStreak = 1;

    // Sort by date ascending for streak calculation
    const sorted = [...completions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let previousDate: Date | null = null;

    for (const completion of sorted) {
      if (!previousDate) {
        previousDate = completion.date;
        longestStreak = 1;
        continue;
      }

      const daysDiff = Math.floor(
        (completion.date.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        // Consecutive day
        currentStreak++;
      } else {
        // Gap found, reset streak
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }

      previousDate = completion.date;
      longestStreak = Math.max(longestStreak, currentStreak);
    }

    return longestStreak;
  }

  /**
   * Get weekly activity (last 7 days)
   */
  private static getWeeklyActivity(completions: any[]): Array<{
    date: string;
    completed: boolean;
    score?: number;
  }> {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 6); // Last 7 days
    start.setUTCHours(0, 0, 0, 0);
    const startString = this.getDateString(start);

    const completionMap = new Map(
      completions
        .filter(c => c.dateString >= startString)
        .map(c => [c.dateString, c])
    );

    const result = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      const dateString = this.getDateString(date);
      const completion = completionMap.get(dateString);

      result.push({
        date: dateString,
        completed: !!completion,
        score: completion?.score,
      });
    }

    return result;
  }

  /**
   * Check if user should unlock a badge and unlock it
   */
  private static async checkBadgeUnlock(userId: string): Promise<Badge | null> {
    try {
      const userStreak = await UserStreak.findOne({
        userId: new Types.ObjectId(userId),
      }).lean().exec();

      if (!userStreak || userStreak.currentStreak === 0) {
        return null;
      }

      // Check each badge definition
      for (const badgeDef of BADGE_DEFINITIONS) {
        // Check if badge is already unlocked
        const alreadyUnlocked = userStreak.badges.some(
          (b: Badge) => b.badgeId === badgeDef.badgeId
        );

        if (!alreadyUnlocked && userStreak.currentStreak >= badgeDef.milestone) {
          // Unlock badge
          const newBadge: Badge = {
            badgeId: badgeDef.badgeId,
            badgeName: badgeDef.badgeName,
            unlockedAt: new Date(),
            milestone: badgeDef.milestone,
          };

          await UserStreak.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            {
              $push: { badges: newBadge },
            }
          ).exec();

          logger.info('Badge unlocked', {
            userId,
            badgeId: badgeDef.badgeId,
            streak: userStreak.currentStreak,
          });

          return newBadge;
        }
      }

      return null;
    } catch (error: any) {
      logger.error('Error checking badge unlock', {
        userId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get streak data for a user
   */
  static async getStreakData(userId: string): Promise<StreakData> {
    if (!this.streakFeatureEnabled()) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        streakStartDate: null,
        todayCompleted: false,
        yesterdayCompleted: false,
        weeklyActivity: this.getEmptyWeeklyActivity(),
        badges: [],
      };
    }

    try {
      const todayString = this.getTodayString();
      const yesterdayString = this.getYesterdayString();

      // Get user streak record
      let userStreak = await UserStreak.findOne({
        userId: new Types.ObjectId(userId),
      }).lean().exec();

      // If no streak record exists, create one
      if (!userStreak) {
        await this.updateStreak(userId);
        userStreak = await UserStreak.findOne({
          userId: new Types.ObjectId(userId),
        }).lean().exec();
      }

      if (!userStreak) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
          streakStartDate: null,
          todayCompleted: false,
          yesterdayCompleted: false,
          weeklyActivity: this.getEmptyWeeklyActivity(),
          badges: [],
        };
      }

      const mergedForFlags = await this.getMergedStreakDayRows(userId);
      const todayCompleted = mergedForFlags.some(
        (r) => r.dateString === todayString
      );
      const yesterdayCompleted = mergedForFlags.some(
        (r) => r.dateString === yesterdayString
      );

      return {
        currentStreak: userStreak.currentStreak || 0,
        longestStreak: userStreak.longestStreak || 0,
        lastActivityDate: userStreak.lastActivityDate || null,
        streakStartDate: userStreak.streakStartDate || null,
        todayCompleted,
        yesterdayCompleted,
        weeklyActivity: userStreak.weeklyActivity || this.getEmptyWeeklyActivity(),
        badges: userStreak.badges || [],
      };
    } catch (error: any) {
      logger.error('Error getting streak data', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get empty weekly activity
   */
  private static getEmptyWeeklyActivity(): Array<{
    date: string;
    completed: boolean;
    score?: number;
  }> {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);

    const result = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      result.push({
        date: this.getDateString(date),
        completed: false,
      });
    }

    return result;
  }
}

// Export Badge type
export type Badge = {
  badgeId: string;
  badgeName: string;
  unlockedAt: Date;
  milestone: number;
};

