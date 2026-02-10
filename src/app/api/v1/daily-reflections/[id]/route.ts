import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import DailyReflection from '@/models/daily-reflection';
import { z } from 'zod';
import { Types } from 'mongoose';

const updateReflectionSchema = z.object({
  content: z.string().min(1).optional(),
  mood: z.enum(['comfortable', 'okay', 'uncertain', 'nervous', 'struggled']).optional(),
  prompt: z.string().max(200).optional(),
});

// GET /api/v1/daily-reflections/[id] - Get a single reflection
async function getReflection(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string; params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    
    const reflection = await DailyReflection.findOne({
      _id: id,
      userId: context.userId,
    }).lean();

    if (!reflection) {
      return NextResponse.json(
        { message: 'Reflection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ reflection });
  } catch (error: any) {
    console.error('Error fetching reflection:', error);
    return NextResponse.json(
      { message: 'Failed to fetch reflection' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/daily-reflections/[id] - Update a reflection
async function updateReflection(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string; params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    
    const body = await req.json();
    const result = updateReflectionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.issues },
        { status: 400 }
      );
    }

    const reflection = await DailyReflection.findOneAndUpdate(
      { _id: id, userId: context.userId },
      { $set: result.data },
      { new: true, runValidators: true }
    );

    if (!reflection) {
      return NextResponse.json(
        { message: 'Reflection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ reflection });
  } catch (error: any) {
    console.error('Error updating reflection:', error);
    return NextResponse.json(
      { message: 'Failed to update reflection' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/daily-reflections/[id] - Delete a reflection
async function deleteReflection(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string; params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    
    const reflection = await DailyReflection.findOneAndDelete({
      _id: id,
      userId: context.userId,
    });

    if (!reflection) {
      return NextResponse.json(
        { message: 'Reflection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Reflection deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting reflection:', error);
    return NextResponse.json(
      { message: 'Failed to delete reflection' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getReflection);
export const PUT = withAuth(updateReflection);
export const DELETE = withAuth(deleteReflection);





