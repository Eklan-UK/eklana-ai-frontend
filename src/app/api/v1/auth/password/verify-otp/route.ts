// POST /api/v1/auth/password/verify-otp
// Verify OTP for password reset (public - no auth required)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import mongoose from 'mongoose';

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
    const { email, otp } = body;

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

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'OTP must be a 6-digit number',
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const PasswordOTP = getPasswordOTPModel();
    
    // Find OTP record
    const otpRecord = await PasswordOTP.findOne({
      email: email.toLowerCase(),
      otp,
      verified: false,
    }).lean().exec();

    if (!otpRecord) {
      // Try to find any unverified OTP for this email to increment attempts
      const anyOtpRecord = await PasswordOTP.findOne({
        email: email.toLowerCase(),
        verified: false,
      }).lean().exec();
      
      if (anyOtpRecord) {
        await PasswordOTP.updateOne(
          { _id: anyOtpRecord._id },
          { $inc: { attempts: 1 } }
        );
      }
      
      return NextResponse.json(
        {
          code: 'InvalidOTP',
          message: 'Invalid OTP. Please check and try again.',
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

    // Check if too many attempts (max 5 attempts)
    if (otpRecord.attempts >= 5) {
      await PasswordOTP.deleteOne({ _id: otpRecord._id });
      return NextResponse.json(
        {
          code: 'TooManyAttempts',
          message: 'Too many failed attempts. Please request a new OTP.',
        },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await PasswordOTP.updateOne(
      { _id: otpRecord._id },
      { $set: { verified: true } }
    );

    logger.info('Password reset OTP verified', {
      userId: otpRecord.userId.toString(),
      email: otpRecord.email,
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'OTP verified successfully.',
        data: {
          verified: true,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error verifying OTP', {
      error: error.message,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Failed to verify OTP. Please try again.',
      },
      { status: 500 }
    );
  }
}

