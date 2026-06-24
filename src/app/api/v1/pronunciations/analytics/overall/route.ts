// GET /api/v1/pronunciations/analytics/overall
// Get overall pronunciation analytics across all learners
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import {
	getOverallDifficultWords,
	getOverallProblemAreasWithWords,
	getOverallStats,
} from '@/domain/pronunciations/pronunciation-analytics.service';

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30'); // Default to last 30 days

    const [stats, problemAreas, difficultWords] = await Promise.all([
      getOverallStats(days),
      getOverallProblemAreasWithWords(days),
      getOverallDifficultWords(days),
    ]);

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Overall analytics retrieved successfully',
        data: {
          stats,
          problemAreas,
          difficultWords,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error fetching overall pronunciation analytics', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: error.message || 'Failed to fetch overall analytics',
      },
      { status: 500 }
    );
  }
}

export const GET = withRole(['admin', 'tutor'], handler);
