import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/api/logger';
import { connectToDatabase } from '@/lib/api/db';
import { Feedback } from '@/models/feedback';
import { withAuth } from '@/lib/api/middleware';
import { Types } from 'mongoose';

const bodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rating: z.number().int().min(1).max(5),
  message: z.string().default(''),
});

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    const json = await req.json();
    const data = bodySchema.parse(json);

    await connectToDatabase();
    await Feedback.create({
      name: data.name,
      rating: data.rating,
      message: data.message,
      userId: context.userId,
    });

    logger.info('Feedback received', { userId: context.userId.toString(), rating: data.rating });

    return NextResponse.json(
      { code: 'Success', message: 'Thank you for your feedback!' },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Invalid request body', errors: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error handling feedback submission', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { code: 'ServerError', message: 'Failed to submit feedback. Please try again later.' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);
