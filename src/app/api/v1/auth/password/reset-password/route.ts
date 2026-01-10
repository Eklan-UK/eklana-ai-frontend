// POST /api/v1/auth/password/reset-password
// Reset password with token (public - no auth required)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { token, newPassword } = body;

    if (!token) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Reset token is required',
        },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'New password is required',
        },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Password must be at least 8 characters long',
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get or create PasswordReset model
    let PasswordReset;
    if (mongoose.models.PasswordReset) {
      PasswordReset = mongoose.models.PasswordReset;
    } else {
      const passwordResetSchema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
        token: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
      }, { collection: 'passwordresets', timestamps: true });
      
      PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
    }

    // Find reset token
    const resetRecord = await PasswordReset.findOne({ token }).lean().exec();

    if (!resetRecord) {
      return NextResponse.json(
        {
          code: 'InvalidToken',
          message: 'Invalid or expired reset token. Please request a new password reset.',
        },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > new Date(resetRecord.expiresAt)) {
      // Delete expired token
      await PasswordReset.deleteOne({ token });
      return NextResponse.json(
        {
          code: 'ExpiredToken',
          message: 'Reset token has expired. Please request a new password reset.',
        },
        { status: 400 }
      );
    }

    // Get user
    const user = await User.findById(resetRecord.userId).select('+password').exec();

    if (!user) {
      return NextResponse.json(
        {
          code: 'NotFoundError',
          message: 'User not found',
        },
        { status: 404 }
      );
    }

    // Hash and update the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await User.findByIdAndUpdate(resetRecord.userId, {
      $set: { password: hashedPassword },
    }).exec();

    // Also update in Better Auth's accounts collection if it exists
    try {
      const db = mongoose.connection.db;
      if (db) {
        // Better Auth stores credentials in 'accounts' collection
        await db.collection('accounts').updateOne(
          { userId: resetRecord.userId.toString(), providerId: 'credential' },
          { $set: { password: hashedPassword } }
        );
      }
    } catch (accountError) {
      // Non-critical - Better Auth account update failed, but User model password was updated
      logger.warn('Failed to update Better Auth account password', { error: accountError });
    }

    // Delete the reset token
    await PasswordReset.deleteOne({ token });

    logger.info('Password reset successfully', {
      userId: resetRecord.userId.toString(),
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Password has been reset successfully. You can now sign in with your new password.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error resetting password', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Failed to reset password. Please try again.',
      },
      { status: 500 }
    );
  }
}


