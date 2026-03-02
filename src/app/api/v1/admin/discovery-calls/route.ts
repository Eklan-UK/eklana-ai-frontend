// GET /api/v1/admin/discovery-calls
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { DiscoveryCall } from '@/models/discovery-call';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const limitParams = searchParams.get('limit');
    const offsetParams = searchParams.get('offset');
    
    const limit = limitParams ? parseInt(limitParams, 10) : 50;
    const offset = offsetParams ? parseInt(offsetParams, 10) : 0;

    await connectToDatabase();

    const [calls, total] = await Promise.all([
      DiscoveryCall.find({})
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      DiscoveryCall.countDocuments({}),
    ]);

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Discovery calls retrieved successfully',
        data: {
          calls,
          total,
          limit,
          offset,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error fetching discovery calls', {
      error: error.message,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Failed to Fetch discovery calls',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withRole(['admin'], handler);
