// GET /api/v1/admin/subscriptions
// Syncs premium / provider-backed learners from Stripe & Apple, then returns the list.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { syncAllPremiumSubscriptionsFromProviders } from '@/domain/subscriptions/subscription-provider-sync.service';

async function handler(
  req: NextRequest,
  _context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const syncProviders = searchParams.get('sync') !== 'false';

    let syncSummary = {
      syncedCount: 0,
      failedCount: 0,
    };

    if (syncProviders) {
      const syncResult = await syncAllPremiumSubscriptionsFromProviders();
      syncSummary = {
        syncedCount: syncResult.syncedCount,
        failedCount: syncResult.failedCount,
      };
    }

    const users = await User.find({ role: 'user' })
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const learners = users;

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Subscriptions retrieved successfully',
        data: {
          learners,
          sync: syncSummary,
          pagination: {
            total: users.length,
            limit,
            offset: 0,
            hasMore: false,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching admin subscriptions', {
      error: err.message,
      stack: err.stack,
    });

    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Failed to load subscriptions',
      },
      { status: 500 }
    );
  }
}

export const GET = withRole(['admin'], handler);
