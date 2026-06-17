import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Bookmark from '@/models/bookmark';
import { Types } from 'mongoose';

// GET /api/v1/bookmarks/drill-status - Bookmarked drill IDs for the current user
async function getDrillBookmarkStatus(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
) {
  try {
    await connectToDatabase();

    const rows = await Bookmark.find({
      userId: context.userId,
      type: 'drill',
    })
      .select('drillId')
      .lean()
      .exec();

    return NextResponse.json({
      bookmarkedDrillIds: rows.map((row) => String(row.drillId)),
    });
  } catch (error: unknown) {
    console.error('Error fetching drill bookmark status:', error);
    return NextResponse.json(
      { message: 'Failed to fetch drill bookmark status' },
      { status: 500 },
    );
  }
}

export const GET = withAuth(getDrillBookmarkStatus);
