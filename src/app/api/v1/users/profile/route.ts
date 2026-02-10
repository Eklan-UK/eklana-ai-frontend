// PATCH /api/v1/users/profile
// Update user profile (name, email, etc.)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(50).optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
});

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const body = await req.json();
    const validated = updateProfileSchema.parse(body);

    const user = await User.findById(context.userId);
    if (!user) {
      return NextResponse.json(
        {
          code: 'NotFoundError',
          message: 'User not found',
        },
        { status: 404 }
      );
    }

    // Update fields
    if (validated.firstName !== undefined) {
      user.firstName = validated.firstName;
    }
    if (validated.lastName !== undefined) {
      user.lastName = validated.lastName;
    }
    if (validated.username !== undefined) {
      // Check if username is already taken by another user
      if (validated.username) {
        const existingUser = await User.findOne({
          username: validated.username.toLowerCase(),
          _id: { $ne: context.userId },
        });
        if (existingUser) {
          return NextResponse.json(
            {
              code: 'ValidationError',
              message: 'Username is already taken',
            },
            { status: 400 }
          );
        }
        user.username = validated.username.toLowerCase();
      } else {
        user.username = undefined;
      }
    }
    if (validated.email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: validated.email.toLowerCase(),
        _id: { $ne: context.userId },
      });
      if (existingUser) {
        return NextResponse.json(
          {
            code: 'ValidationError',
            message: 'Email is already taken',
          },
          { status: 400 }
        );
      }
      user.email = validated.email.toLowerCase();
    }
    if (validated.phone !== undefined) {
      user.phone = validated.phone;
    }
    if (validated.dateOfBirth !== undefined) {
      user.dateOfBirth = validated.dateOfBirth ? new Date(validated.dateOfBirth) : undefined;
    }

    // Sync name field for Better Auth compatibility
    user.name = `${user.firstName} ${user.lastName}`.trim();

    await user.save();

    // Return updated user (without password)
    const updatedUser = await User.findById(context.userId)
      .select('-password -__v')
      .lean()
      .exec();

    logger.info('Profile updated successfully', {
      userId: context.userId,
      updatedFields: Object.keys(validated),
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Profile updated successfully',
        data: {
          user: updatedUser,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Validation failed',
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    logger.error('Error updating profile', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        code: 'ServerError',
        message: error.message || 'Failed to update profile',
      },
      { status: 500 }
    );
  }
}

export const PATCH = withAuth(handler);

