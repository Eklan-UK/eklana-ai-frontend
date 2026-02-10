// POST /api/v1/auth/email/verify-email
// Verify email using token
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Verification token is required',
        },
        { status: 400 }
      );
    }

    // Find verification token in database
    let Verification;
    if (mongoose.models.Verification) {
      Verification = mongoose.models.Verification;
    } else {
      const verificationSchema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
        token: { type: String, required: false, sparse: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
      }, { collection: 'verifications', timestamps: true });
      
      // Create sparse unique index on token (allows multiple nulls)
      verificationSchema.index({ token: 1 }, { unique: true, sparse: true });
      
      Verification = mongoose.model('Verification', verificationSchema);
    }

    // Find verification record
    const verification = await Verification.findOne({ token }).lean().exec();

    if (!verification) {
      return NextResponse.json(
        {
          code: 'NotFoundError',
          message: 'Invalid or expired verification token',
        },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (new Date() > new Date(verification.expiresAt)) {
      // Delete expired token
      await Verification.deleteOne({ token });
      return NextResponse.json(
        {
          code: 'ExpiredToken',
          message: 'Verification token has expired. Please request a new one.',
        },
        { status: 400 }
      );
    }

    // Get user
    const user = await User.findById(verification.userId).lean().exec();

    if (!user) {
      return NextResponse.json(
        {
          code: 'NotFoundError',
          message: 'User not found',
        },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.emailVerified || user.isEmailVerified) {
      // Delete verification token
      await Verification.deleteOne({ token });
      return NextResponse.json(
        {
          code: 'AlreadyVerified',
          message: 'Email is already verified',
          user: {
            id: user._id.toString(),
            email: user.email,
            name: user.name || user.firstName,
            emailVerified: true,
          },
        },
        { status: 200 }
      );
    }

    // Update user email verification status
    await User.findByIdAndUpdate(verification.userId, {
      $set: {
        emailVerified: true,
        isEmailVerified: true,
      },
    }).exec();

    // Delete verification token
    await Verification.deleteOne({ token });

    // Get updated user
    const updatedUser = await User.findById(verification.userId).lean().exec();

    logger.info('Email verified successfully', {
      userId: verification.userId.toString(),
      email: user.email,
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Email verified successfully',
        user: {
          id: updatedUser?._id.toString(),
          email: updatedUser?.email,
          name: updatedUser?.name || updatedUser?.firstName,
          emailVerified: true,
          isEmailVerified: true,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error verifying email', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Internal Server Error',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

