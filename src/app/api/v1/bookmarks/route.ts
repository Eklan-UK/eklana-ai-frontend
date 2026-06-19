import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Bookmark from '@/models/bookmark';
import { z } from 'zod';
import { Types } from 'mongoose';

// Schema for creating a bookmark
const createBookmarkSchema = z.object({
  drillId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid drill ID',
  }),
  type: z.enum(['word', 'sentence', 'drill']),
  content: z.string().min(1),
  translation: z.string().optional(),
  context: z.string().optional(),
});

// GET /api/v1/bookmarks - Get all bookmarks for the current user
async function getBookmarks(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    await connectToDatabase();
    
    // Sort by most recent first
    const bookmarks = await Bookmark.find({ userId: context.userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ bookmarks });
  } catch (error: any) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { message: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}

// POST /api/v1/bookmarks - Create a new bookmark
async function createBookmark(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const result = createBookmarkSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.issues },
        { status: 400 }
      );
    }

    const { drillId, type, content, translation, context: bookmarkContext } = result.data;

    // Check for duplicate
    const existing = await Bookmark.findOne({
      userId: context.userId,
      drillId,
      content,
    });

    if (existing) {
      return NextResponse.json(
        { message: 'Already bookmarked', bookmark: existing },
        { status: 200 } // Or 409 Conflict, but 200 is often safer for idempotency
      );
    }

    const bookmark = await Bookmark.create({
      userId: context.userId,
      drillId,
      type,
      content,
      translation,
      context: bookmarkContext,
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bookmark:', error);
    return NextResponse.json(
      { message: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getBookmarks);
export const POST = withAuth(createBookmark);
