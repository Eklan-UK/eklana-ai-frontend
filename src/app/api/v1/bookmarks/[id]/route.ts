import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Bookmark from '@/models/bookmark';
import { Types } from 'mongoose';

// DELETE /api/v1/bookmarks/[id] - Delete a bookmark
async function deleteBookmark(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string; params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await context.params;

    const result = await Bookmark.deleteOne({
      _id: id,
      userId: context.userId, // Ensure ownership
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { message: 'Bookmark not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Bookmark deleted' });
  } catch (error: any) {
    console.error('Error deleting bookmark:', error);
    return NextResponse.json(
      { message: 'Failed to delete bookmark' },
      { status: 500 }
    );
  }
}

// GET /api/v1/bookmarks/[id] - Get a single bookmark (for practice page)
async function getBookmark(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string; params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await context.params;

    const bookmark = await Bookmark.findOne({
      _id: id,
      userId: context.userId,
    }).lean();

    if (!bookmark) {
      return NextResponse.json(
        { message: 'Bookmark not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ bookmark });
  } catch (error: any) {
    console.error('Error fetching bookmark:', error);
    return NextResponse.json(
      { message: 'Failed to fetch bookmark' },
      { status: 500 }
    );
  }
}

export const DELETE = withAuth(deleteBookmark);
export const GET = withAuth(getBookmark);

