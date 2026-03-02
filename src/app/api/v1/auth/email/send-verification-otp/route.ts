// POST /api/v1/auth/email/send-verification-otp
// Send a 6-digit OTP for email verification (authenticated – user must be logged in)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import { sendEmail } from '@/lib/api/email.service';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Rate limiting per user
const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per minute

function isRateLimited(userId: string): boolean {
	const now = Date.now();
	const record = rateLimitMap.get(userId);

	if (!record || now - record.lastRequest > RATE_LIMIT_WINDOW) {
		rateLimitMap.set(userId, { count: 1, lastRequest: now });
		return false;
	}

	if (record.count >= RATE_LIMIT_MAX) {
		return true;
	}

	record.count++;
	record.lastRequest = now;
	return false;
}

// Get or create EmailVerificationOTP model
function getEmailVerificationOTPModel() {
	if (mongoose.models.EmailVerificationOTP) {
		return mongoose.models.EmailVerificationOTP;
	}

	const schema = new mongoose.Schema(
		{
			userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
			email: { type: String, required: true, index: true },
			otp: { type: String, required: true },
			expiresAt: { type: Date, required: true },
			attempts: { type: Number, default: 0 },
			verified: { type: Boolean, default: false },
			createdAt: { type: Date, default: Date.now },
		},
		{ collection: 'emailverificationotps', timestamps: true }
	);

	// Auto-delete expired docs
	schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

	return mongoose.model('EmailVerificationOTP', schema);
}

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		// Rate limit per user
		if (isRateLimited(context.userId.toString())) {
			return NextResponse.json(
				{ code: 'RateLimited', message: 'Too many requests. Please wait a minute before trying again.' },
				{ status: 429 }
			);
		}

		await connectToDatabase();

		const user = await User.findById(context.userId).lean().exec();
		if (!user) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'User not found' },
				{ status: 404 }
			);
		}

		// Already verified
		if (user.emailVerified || user.isEmailVerified) {
			return NextResponse.json(
				{ code: 'AlreadyVerified', message: 'Email is already verified.' },
				{ status: 400 }
			);
		}

		// Generate 6-digit OTP
		const otp = crypto.randomInt(100000, 999999).toString();

		const EmailVerificationOTP = getEmailVerificationOTPModel();

		// Remove previous OTPs for this user
		await EmailVerificationOTP.deleteMany({ userId: context.userId });

		// Create new OTP – expires in 10 minutes
		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + 10);
		await EmailVerificationOTP.create({
			userId: context.userId,
			email: user.email.toLowerCase(),
			otp,
			expiresAt,
			attempts: 0,
			verified: false,
		});

		// Send email
		await sendEmail({
			to: user.email,
			subject: 'Verify Your Email – OTP',
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Email Verification OTP</title>
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
					<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
						<div style="text-align: center; margin-bottom: 30px;">
							<div style="font-size: 24px; font-weight: bold; color: #22c55e;">eklan</div>
						</div>
						<div style="background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
							<div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center;">
								<div style="font-size: 48px; margin-bottom: 10px;">✉️</div>
								<h1 style="margin: 0; font-size: 24px; font-weight: 600;">Verify Your Email</h1>
							</div>
							<div style="padding: 30px;">
								<p style="margin: 0 0 20px 0; font-size: 16px;">Hi <strong>${user.name || user.firstName || 'User'}</strong>,</p>
								<p style="margin: 0 0 25px 0; font-size: 16px; color: #4b5563;">Use this code to verify your email address:</p>
								<div style="text-align: center; margin: 30px 0;">
									<div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 20px 40px; border-radius: 12px; font-size: 32px; font-weight: 700; letter-spacing: 8px; box-shadow: 0 4px 6px -1px rgba(34,197,94,0.4);">
										${otp}
									</div>
								</div>
								<p style="margin: 25px 0 0 0; font-size: 14px; color: #6b7280;">This code will expire in <strong>10 minutes</strong>.</p>
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
			text: `Hi ${user.name || user.firstName || 'User'},\n\nYour email verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
		});

		logger.info('Email verification OTP sent', {
			userId: context.userId.toString(),
			email: user.email,
		});

		return NextResponse.json(
			{ code: 'Success', message: 'Verification code sent to your email.' },
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error sending email verification OTP', { error: error.message });
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to send verification code. Please try again.' },
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

