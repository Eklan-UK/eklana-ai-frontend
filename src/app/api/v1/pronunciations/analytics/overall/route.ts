// GET /api/v1/pronunciations/analytics/overall
// Get overall pronunciation analytics across all learners
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30'); // Default to last 30 days

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Overall Statistics (Total Attempts, Avg Score, Pass Rate)
    const overallStats = await PronunciationAttempt.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$textScore' },
          passedCount: {
            $sum: { $cond: [{ $eq: ['$passed', true] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalAttempts: 1,
          averageScore: { $round: ['$averageScore', 1] },
          passRate: {
            $multiply: [
              { $divide: ['$passedCount', '$totalAttempts'] },
              100,
            ],
          },
        },
      },
    ]);

    const stats = overallStats[0] || {
      totalAttempts: 0,
      averageScore: 0,
      passRate: 0,
    };

    // 2. Top Incorrect Letters
    const topIncorrectLetters = await PronunciationAttempt.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$incorrectLetters' },
      {
        $group: {
          _id: '$incorrectLetters',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          letter: '$_id',
          count: 1,
        },
      },
    ]);

    // 3. Top Incorrect Phonemes
    const topIncorrectPhonemes = await PronunciationAttempt.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$incorrectPhonemes' },
      {
        $group: {
          _id: '$incorrectPhonemes',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          phoneme: '$_id',
          count: 1,
        },
      },
    ]);

    // 4. Most Difficult Words
    // Group by pronunciationId/wordId to find words with lowest average scores
    const difficultWords = await PronunciationAttempt.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      // Lookup to get word/pronunciation details if needed, 
      // but for now we'll rely on what's available or just group by ID
      // Assuming we can get title/text from populated fields or stored data
      // For efficiency, let's group by pronunciationId first
      {
        $group: {
          _id: '$pronunciationId',
          attempts: { $sum: 1 },
          avgScore: { $avg: '$textScore' },
          passCount: {
            $sum: { $cond: [{ $eq: ['$passed', true] }, 1, 0] },
          },
        },
      },
      { $match: { attempts: { $gte: 3 } } }, // Filter out words with very few attempts
      {
        $lookup: {
          from: 'pronunciations', // Assuming collection name
          localField: '_id',
          foreignField: '_id',
          as: 'pronunciation',
        },
      },
      { $unwind: '$pronunciation' },
      {
        $project: {
          _id: 1,
          word: '$pronunciation.title',
          text: '$pronunciation.text',
          attempts: 1,
          avgScore: { $round: ['$avgScore', 1] },
          passRate: {
            $multiply: [
              { $divide: ['$passCount', '$attempts'] },
              100,
            ],
          },
        },
      },
      { $sort: { avgScore: 1 } }, // Lowest score first
      { $limit: 10 },
    ]);

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Overall analytics retrieved successfully',
        data: {
          stats: {
            ...stats,
            passRate: Math.round(stats.passRate * 10) / 10,
          },
          problemAreas: {
            topIncorrectLetters,
            topIncorrectPhonemes,
          },
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

