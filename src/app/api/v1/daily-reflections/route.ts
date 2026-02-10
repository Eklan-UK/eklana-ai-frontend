import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DailyReflection from '@/models/daily-reflection';
import { z } from 'zod';
import { Types } from 'mongoose';

const createReflectionSchema = z.object({
  content: z.string().min(1),
  mood: z.enum(['comfortable', 'okay', 'uncertain', 'nervous', 'struggled']),
  prompt: z.string().max(200),
});

// GET /api/v1/daily-reflections - Get all reflections for the current user
async function getReflections(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const query: any = { userId: context.userId };
    
    const reflections = await DailyReflection.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await DailyReflection.countDocuments(query);

    return NextResponse.json({ 
      reflections,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      }
    });
  } catch (error: any) {
    console.error('Error fetching reflections:', error);
    return NextResponse.json(
      { message: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}

// POST /api/v1/daily-reflections - Create a new reflection
async function createReflection(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const result = createReflectionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.issues },
        { status: 400 }
      );
    }

    const reflection = await DailyReflection.create({
      userId: context.userId,
      ...result.data,
    });

    return NextResponse.json({ reflection }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating reflection:', error);
    return NextResponse.json(
      { message: 'Failed to create reflection' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getReflections);
export const POST = withAuth(createReflection);





