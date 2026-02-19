// POST /api/v1/auth/password/forgot-password
// Request password reset email (public - no auth required)
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
    
    // Don't reveal if user exists - return success either way for security
    if (!user) {
      logger.info('Password reset requested for non-existent user', { email });
      return NextResponse.json(
        {
          code: 'Success',
          message: 'If an account exists with this email, a password reset link has been sent.',
        },
        { status: 200 }
      );
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    
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
    
    // Delete old reset tokens for this user
    await PasswordReset.deleteMany({ userId: user._id });
    
    // Create new reset token (expires in 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    await PasswordReset.create({
      userId: user._id,
      token,
      expiresAt,
    });
    
    // Build reset URL
    const baseURL = config.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const resetUrl = `${baseURL}/auth/reset-password?token=${token}`;
    
    // Send reset email
    const { sendEmail } = await import('@/lib/api/email.service');
    await sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${baseURL}/logo2.png" alt="eklan Logo" width="60" height="60" style="border-radius: 12px; margin-bottom: 10px;">
              <div style="font-size: 24px; font-weight: bold; color: #22c55e;">eklan</div>
            </div>
            
            <div style="background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Password Reset Request</h1>
              </div>
              
              <div style="padding: 30px;">
                <p style="margin: 0 0 20px 0; font-size: 16px;">Hi <strong>${user.name || user.firstName || 'User'}</strong>,</p>
                <p style="margin: 0 0 25px 0; font-size: 16px; color: #4b5563;">We received a request to reset your password. Click the button below to create a new password:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.4);">Reset Password</a>
                </div>
                
                <p style="margin: 25px 0 0 0; font-size: 14px; color: #6b7280;">This link will expire in <strong>1 hour</strong>.</p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from Eklan.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${user.name || user.firstName || 'User'},

We received a request to reset your password.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.
      `,
    });

    logger.info('Password reset email sent', {
      userId: user._id.toString(),
      email: user.email,
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'If an account exists with this email, a password reset link has been sent.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error sending password reset email', {
      error: error.message,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Failed to send password reset email. Please try again.',
      },
      { status: 500 }
    );
  }
}


