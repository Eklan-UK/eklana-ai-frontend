// POST /api/v1/auth/email/send-verification
// Public endpoint to send verification email by email address
// This does NOT require authentication - for use during signup or sign-in when unverified
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import config from '@/lib/api/config';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Rate limiting: track requests by IP
const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now - record.lastRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastRequest: now });
    return false;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  record.count++;
  record.lastRequest = now;
  return false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Get IP for rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          code: 'RateLimited',
          message: 'Too many requests. Please wait a minute before trying again.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Email is required',
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).lean().exec();
    
    if (!user) {
      // Don't reveal if user exists - return success either way for security
      logger.info('Verification email requested for non-existent user', { email });
      return NextResponse.json(
        {
          code: 'Success',
          message: 'If an account exists with this email, a verification link has been sent.',
        },
        { status: 200 }
      );
    }

    // Check if already verified
    if (user.emailVerified || user.isEmailVerified) {
      return NextResponse.json(
        {
          code: 'AlreadyVerified',
          message: 'This email is already verified. You can sign in.',
        },
        { status: 200 }
      );
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Get or create Verification model
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
    
    // Delete old verification tokens for this user
    await Verification.deleteMany({ userId: user._id });
    
    // Create new verification token (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await Verification.create({
      userId: user._id,
      token,
      expiresAt,
    });
    
    // Build verification URL
    const baseURL = config.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const verificationUrl = `${baseURL}/auth/verify-email/confirm?token=${token}`;
    
    // Send verification email
    const { sendEmailVerification } = await import('@/lib/api/email.service');
    await sendEmailVerification({
      email: user.email,
      name: user.name || user.firstName || 'User',
      verificationLink: verificationUrl,
    });

    logger.info('Verification email sent', {
      userId: user._id.toString(),
      email: user.email,
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Verification email sent successfully. Please check your inbox.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error sending verification email', {
      error: error.message,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Failed to send verification email. Please try again.',
      },
      { status: 500 }
    );
  }
}


