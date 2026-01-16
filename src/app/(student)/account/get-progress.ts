// Server-side function to get user progress from completed drills
import { cookies } from 'next/headers';

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

export async function getUserProgress(): Promise<UserProgress> {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Fetch user's drills to calculate progress
    const response = await fetch(`${baseURL}/api/v1/drills/learner/my-drills?limit=100`, {
      credentials: 'include',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return getDefaultProgress();
    }

    const data = await response.json();
    const drills = data.data?.drills || data.drills || [];

    // Calculate progress metrics
    const completedDrills = drills.filter((d: any) => 
      d.status === 'completed' || d.completedAt
    );
    
    const drillsCompleted = completedDrills.length;
    const drillsTotal = drills.length;
    const completionRate = drillsTotal > 0 
      ? Math.round((drillsCompleted / drillsTotal) * 100) 
      : 0;

    // Calculate average score from completed drills with scores
    const drillsWithScores = completedDrills.filter((d: any) => 
      d.latestAttempt?.score != null || d.score != null
    );
    
    const averageScore = drillsWithScores.length > 0
      ? Math.round(
          drillsWithScores.reduce((sum: number, d: any) => 
            sum + (d.latestAttempt?.score || d.score || 0), 0
          ) / drillsWithScores.length
        )
      : 0;

    // Calculate pronunciation score from vocabulary and roleplay drills
    const pronunciationDrills = completedDrills.filter((d: any) => 
      d.drill?.type === 'vocabulary' || d.drill?.type === 'roleplay'
    );
    
    const pronunciationScore = pronunciationDrills.length > 0
      ? Math.round(
          pronunciationDrills.reduce((sum: number, d: any) => 
            sum + (d.latestAttempt?.score || d.score || 0), 0
          ) / pronunciationDrills.length
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

function calculateStreak(completedDrills: any[]): number {
  if (completedDrills.length === 0) return 0;

  // Sort by completion date
  const sortedDrills = [...completedDrills]
    .filter(d => d.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  if (sortedDrills.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Get unique completion dates
  const completionDates = new Set(
    sortedDrills.map(d => {
      const date = new Date(d.completedAt);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  );

  // Count consecutive days from today
  for (let i = 0; i <= 30; i++) { // Check up to 30 days
    const checkDate = new Date(currentDate);
    checkDate.setDate(checkDate.getDate() - i);
    
    if (completionDates.has(checkDate.getTime())) {
      streak++;
    } else if (i > 0) { // Allow missing today
      break;
    }
  }

  return streak;
}

function calculateWeeklyChange(completedDrills: any[]): { pronunciation: number; confidence: number } {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // This week's drills
  const thisWeekDrills = completedDrills.filter(d => 
    d.completedAt && new Date(d.completedAt) > oneWeekAgo
  );

  // Last week's drills
  const lastWeekDrills = completedDrills.filter(d => 
    d.completedAt && 
    new Date(d.completedAt) > twoWeeksAgo && 
    new Date(d.completedAt) <= oneWeekAgo
  );

  const thisWeekAvg = thisWeekDrills.length > 0
    ? thisWeekDrills.reduce((sum, d) => sum + (d.latestAttempt?.score || d.score || 0), 0) / thisWeekDrills.length
    : 0;

  const lastWeekAvg = lastWeekDrills.length > 0
    ? lastWeekDrills.reduce((sum, d) => sum + (d.latestAttempt?.score || d.score || 0), 0) / lastWeekDrills.length
    : 0;

  const change = thisWeekAvg - lastWeekAvg;

  return {
    pronunciation: Math.round(change),
    confidence: Math.round(change * 0.8), // Slightly different for variety
  };
}

