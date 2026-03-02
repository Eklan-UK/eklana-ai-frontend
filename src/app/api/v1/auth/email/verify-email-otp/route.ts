// POST /api/v1/auth/email/verify-email-otp
// Verify a 6-digit OTP and mark the user's email as verified (authenticated)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

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

	return mongoose.model('EmailVerificationOTP', schema);
}

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const body = await req.json();
		const { otp } = body;

		if (!otp) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Verification code is required.' },
				{ status: 400 }
			);
		}

		if (!/^\d{6}$/.test(otp)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Verification code must be a 6-digit number.' },
				{ status: 400 }
			);
		}

		await connectToDatabase();

		// Check if already verified
		const user = await User.findById(context.userId).lean().exec();
		if (!user) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'User not found.' },
				{ status: 404 }
			);
		}

		if (user.emailVerified || user.isEmailVerified) {
			return NextResponse.json(
				{ code: 'AlreadyVerified', message: 'Email is already verified.' },
				{ status: 200 }
			);
		}

		const EmailVerificationOTP = getEmailVerificationOTPModel();

		// Look for matching OTP for this user
		const otpRecord = await EmailVerificationOTP.findOne({
			userId: context.userId,
			otp,
			verified: false,
		}).lean().exec();

		if (!otpRecord) {
			// Increment attempts on any unverified OTP for this user
			const anyRecord = await EmailVerificationOTP.findOne({
				userId: context.userId,
				verified: false,
			}).lean().exec();

			if (anyRecord) {
				await EmailVerificationOTP.updateOne(
					{ _id: anyRecord._id },
					{ $inc: { attempts: 1 } }
				);
			}

			return NextResponse.json(
				{ code: 'InvalidOTP', message: 'Invalid verification code. Please check and try again.' },
				{ status: 400 }
			);
		}

		// Check expiry
		if (new Date() > new Date(otpRecord.expiresAt)) {
			await EmailVerificationOTP.deleteOne({ _id: otpRecord._id });
			return NextResponse.json(
				{ code: 'ExpiredOTP', message: 'Verification code has expired. Please request a new one.' },
				{ status: 400 }
			);
		}

		// Check max attempts (5)
		if (otpRecord.attempts >= 5) {
			await EmailVerificationOTP.deleteOne({ _id: otpRecord._id });
			return NextResponse.json(
				{ code: 'TooManyAttempts', message: 'Too many failed attempts. Please request a new code.' },
				{ status: 400 }
			);
		}

		// OTP valid – mark email as verified
		await User.findByIdAndUpdate(context.userId, {
			$set: {
				emailVerified: true,
				isEmailVerified: true,
			},
		}).exec();

		// Clean up OTP records for this user
		await EmailVerificationOTP.deleteMany({ userId: context.userId });

		logger.info('Email verified via OTP', {
			userId: context.userId.toString(),
			email: user.email,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Email verified successfully.',
				data: { emailVerified: true },
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error verifying email OTP', { error: error.message });
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to verify code. Please try again.' },
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

