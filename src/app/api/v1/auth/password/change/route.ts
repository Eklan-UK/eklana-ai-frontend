// POST /api/v1/auth/password/change
// Change password (requires authentication and current password)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    // Validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Current password and new password are required',
        },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'New password must be at least 8 characters long',
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'New password must be different from current password',
        },
        { status: 400 }
      );
    }

    // Get user with password field
    const user = await User.findById(context.userId).select('+password').exec();
    
    if (!user) {
      return NextResponse.json(
        {
          code: 'NotFoundError',
          message: 'User not found',
        },
        { status: 404 }
      );
    }

    // Check if user has a password (OAuth users might not have one)
    if (!user.password) {
      return NextResponse.json(
        {
          code: 'NoPasswordError',
          message: 'Cannot change password for accounts created with social login. Please use your social login provider.',
        },
        { status: 400 }
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          code: 'InvalidPasswordError',
          message: 'Current password is incorrect',
        },
        { status: 400 }
      );
    }

    // Hash and update the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await User.findByIdAndUpdate(context.userId, {
      $set: { password: hashedPassword },
    }).exec();

    // Also update in Better Auth's accounts collection if it exists
    try {
      const mongoose = await import('mongoose');
      const db = mongoose.connection.db;
      if (db) {
        // Better Auth stores credentials in 'accounts' collection
        await db.collection('accounts').updateOne(
          { userId: context.userId.toString(), providerId: 'credential' },
          { $set: { password: hashedPassword } }
        );
      }
    } catch (accountError) {
      // Non-critical - Better Auth account update failed, but User model password was updated
      logger.warn('Failed to update Better Auth account password', { error: accountError });
    }

    logger.info('Password changed successfully', {
      userId: context.userId.toString(),
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Password changed successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error changing password', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Failed to change password. Please try again.',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);


