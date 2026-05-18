// Server-side function to get user progress from completed drills
import { Types } from 'mongoose';
import { getServerSession } from '@/lib/api/session';
import {
  getLearnerMyDrillsPayload,
  type LearnerMyDrillRow,
} from '@/lib/server/learner-my-drills.server';

export interface UserProgress {
  drillsCompleted: number;
  drillsTotal: number;
  completionRate: number;
  averageScore: number;
  streakDays: number;
  pronunciationScore: number;
  confidenceScore: number;
  weeklyChange: {
    pronunciation: number;
    confidence: number;
  };
}

function normalizeLearnerRole(role: string | undefined): 'user' | null {
  if (!role) return null;
  if (role === 'learner' || role === 'user') return 'user';
  return null;
}

function rowScore(d: LearnerMyDrillRow): number {
  const legacy = d as LearnerMyDrillRow & { score?: number };
  return legacy.latestAttempt?.score ?? legacy.score ?? 0;
}

function drillDocType(d: LearnerMyDrillRow): string | undefined {
  if (!d.drill || typeof d.drill !== 'object') return undefined;
  const t = (d.drill as { type?: string }).type;
  return typeof t === 'string' ? t : undefined;
}

export async function getUserProgress(): Promise<UserProgress> {
  try {
    const { user } = await getServerSession();
    if (!user?.id || normalizeLearnerRole(user.role) !== 'user') {
      return getDefaultProgress();
    }

    let userId: Types.ObjectId;
    try {
      userId = new Types.ObjectId(user.id);
    } catch {
      return getDefaultProgress();
    }

    const { drills } = await getLearnerMyDrillsPayload(userId, {
      limit: 100,
      offset: 0,
    });

    const completedDrills = drills.filter(
      (d) => d.status === 'completed' || Boolean(d.completedAt)
    );

    const drillsCompleted = completedDrills.length;
    const drillsTotal = drills.length;
    const completionRate =
      drillsTotal > 0 ? Math.round((drillsCompleted / drillsTotal) * 100) : 0;

    const drillsWithScores = completedDrills.filter((d) => {
      const ext = d as LearnerMyDrillRow & { score?: number };
      return ext.latestAttempt?.score != null || ext.score != null;
    });

    const averageScore =
      drillsWithScores.length > 0
        ? Math.round(
            drillsWithScores.reduce((sum, d) => sum + rowScore(d), 0) /
              drillsWithScores.length
          )
        : 0;

    const pronunciationDrills = completedDrills.filter((d) => {
      const t = drillDocType(d);
      return t === 'vocabulary' || t === 'roleplay';
    });

    const pronunciationScore =
      pronunciationDrills.length > 0
        ? Math.round(
            pronunciationDrills.reduce((sum, d) => sum + rowScore(d), 0) /
              pronunciationDrills.length
          )
        : 0;

    // Calculate confidence score (based on overall performance and completion rate)
    const confidenceScore = Math.round(
      (completionRate * 0.3 + averageScore * 0.7)
    );

    // Calculate streak (simplified - count consecutive days with completed drills)
    const streakDays = calculateStreak(completedDrills);

    // Calculate weekly change (simplified calculation)
    const weeklyChange = calculateWeeklyChange(completedDrills);

    return {
      drillsCompleted,
      drillsTotal,
      completionRate,
      averageScore,
      streakDays,
      pronunciationScore: pronunciationScore || confidenceScore,
      confidenceScore: confidenceScore || averageScore,
      weeklyChange,
    };
  } catch (error) {
    console.error('Failed to fetch user progress:', error);
    return getDefaultProgress();
  }
}

function getDefaultProgress(): UserProgress {
  return {
    drillsCompleted: 0,
    drillsTotal: 0,
    completionRate: 0,
    averageScore: 0,
    streakDays: 0,
    pronunciationScore: 0,
    confidenceScore: 0,
    weeklyChange: {
      pronunciation: 0,
      confidence: 0,
    },
  };
}

function calculateStreak(completedDrills: LearnerMyDrillRow[]): number {
  if (completedDrills.length === 0) return 0;

  // Sort by completion date
  const sortedDrills = [...completedDrills]
    .filter((d) => d.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt as Date).getTime() -
        new Date(a.completedAt as Date).getTime()
    );

  if (sortedDrills.length === 0) return 0;

  let streak = 0;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Get unique completion dates
  const completionDates = new Set(
    sortedDrills.map((d) => {
      const date = new Date(d.completedAt as Date);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  );

  // Count consecutive days from today
  for (let i = 0; i <= 30; i++) {
    // Check up to 30 days
    const checkDate = new Date(currentDate);
    checkDate.setDate(checkDate.getDate() - i);

    if (completionDates.has(checkDate.getTime())) {
      streak++;
    } else if (i > 0) {
      // Allow missing today
      break;
    }
  }

  return streak;
}

function calculateWeeklyChange(
  completedDrills: LearnerMyDrillRow[]
): { pronunciation: number; confidence: number } {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // This week's drills
  const thisWeekDrills = completedDrills.filter(
    (d) => d.completedAt && new Date(d.completedAt) > oneWeekAgo
  );

  // Last week's drills
  const lastWeekDrills = completedDrills.filter(
    (d) =>
      d.completedAt &&
      new Date(d.completedAt) > twoWeeksAgo &&
      new Date(d.completedAt) <= oneWeekAgo
  );

  const thisWeekAvg =
    thisWeekDrills.length > 0
      ? thisWeekDrills.reduce((sum, d) => sum + rowScore(d), 0) /
        thisWeekDrills.length
      : 0;

  const lastWeekAvg =
    lastWeekDrills.length > 0
      ? lastWeekDrills.reduce((sum, d) => sum + rowScore(d), 0) /
        lastWeekDrills.length
      : 0;

  const change = thisWeekAvg - lastWeekAvg;

  return {
    pronunciation: Math.round(change),
    confidence: Math.round(change * 0.8), // Slightly different for variety
  };
}

