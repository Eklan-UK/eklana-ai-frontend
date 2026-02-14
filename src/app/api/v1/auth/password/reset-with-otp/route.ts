// POST /api/v1/auth/password/reset-with-otp
// Reset password with verified OTP (public - no auth required)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Get or create PasswordOTP model
function getPasswordOTPModel() {
  if (mongoose.models.PasswordOTP) {
    return mongoose.models.PasswordOTP;
  }
  
  const passwordOTPSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }, { collection: 'passwordotps', timestamps: true });
  
  return mongoose.model('PasswordOTP', passwordOTPSchema);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { email, otp, newPassword } = body;

    if (!email) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Email is required',
        },
        { status: 400 }
      );
    }

    if (!otp) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'OTP is required',
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

    const PasswordOTP = getPasswordOTPModel();
    
    // Find verified OTP record
    const otpRecord = await PasswordOTP.findOne({
      email: email.toLowerCase(),
      otp,
      verified: true,
    }).lean().exec();

    if (!otpRecord) {
      return NextResponse.json(
        {
          code: 'InvalidOTP',
          message: 'Invalid or unverified OTP. Please verify the OTP first.',
        },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.expiresAt)) {
      await PasswordOTP.deleteOne({ _id: otpRecord._id });
      return NextResponse.json(
        {
          code: 'ExpiredOTP',
          message: 'OTP has expired. Please request a new one.',
        },
        { status: 400 }
      );
    }

    // Get user
    const user = await User.findById(otpRecord.userId).select('+password').exec();

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
    
    await User.findByIdAndUpdate(otpRecord.userId, {
      $set: { password: hashedPassword },
    }).exec();

    // Also update in Better Auth's accounts collection if it exists
    try {
      const db = mongoose.connection.db;
      if (db) {
        // Better Auth stores credentials in 'accounts' collection
        await db.collection('accounts').updateOne(
          { userId: otpRecord.userId.toString(), providerId: 'credential' },
          { $set: { password: hashedPassword } }
        );
      }
    } catch (accountError) {
      // Non-critical - Better Auth account update failed, but User model password was updated
      logger.warn('Failed to update Better Auth account password', { error: accountError });
    }

    // Delete the OTP record
    await PasswordOTP.deleteOne({ _id: otpRecord._id });

    logger.info('Password reset successfully with OTP', {
      userId: otpRecord.userId.toString(),
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Password has been reset successfully. You can now sign in with your new password.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error resetting password with OTP', {
      error: error.message,
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

