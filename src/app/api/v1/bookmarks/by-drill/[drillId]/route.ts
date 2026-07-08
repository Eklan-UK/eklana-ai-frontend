import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Bookmark from '@/models/bookmark';
import { toUserIdCandidates } from '@/lib/api/user-id';
import { Types } from 'mongoose';

// DELETE /api/v1/bookmarks/by-drill/[drillId] - Remove drill-level bookmark
async function deleteDrillBookmark(
  req: NextRequest,
  context: {
    userId: string;
    userRole: string;
    params: Promise<{ drillId: string }>;
  },
) {
  try {
    await connectToDatabase();

    const { drillId } = await context.params;

    if (!Types.ObjectId.isValid(drillId)) {
      return NextResponse.json({ message: 'Invalid drill ID' }, { status: 400 });
    }

    const result = await Bookmark.deleteOne({
      userId: { $in: toUserIdCandidates(context.userId) },
      drillId: new Types.ObjectId(drillId),
      type: 'drill',
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { message: 'Bookmark not found or access denied' },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: 'Bookmark deleted' });
  } catch (error: unknown) {
    console.error('Error deleting drill bookmark:', error);
    return NextResponse.json(
      { message: 'Failed to delete bookmark' },
      { status: 500 },
    );
  }
}

export const DELETE = withAuth(deleteDrillBookmark);
