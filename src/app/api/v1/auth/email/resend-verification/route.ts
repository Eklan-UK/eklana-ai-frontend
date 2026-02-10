// POST /api/v1/auth/email/resend-verification
// Resend email verification using Better Auth
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { getAuth } from '@/lib/api/better-auth';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';
import { Types } from 'mongoose';
import config from '@/lib/api/config';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const auth = await getAuth();
		if (!auth) {
			return NextResponse.json(
				{
					code: 'ServiceUnavailable',
					message: 'Authentication service is not available',
				},
				{ status: 503 }
			);
		}

		// Get current user
		const user = await User.findById(context.userId).lean().exec();
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
			return NextResponse.json(
				{
					code: 'AlreadyVerified',
					message: 'Email is already verified',
				},
				{ status: 400 }
			);
		}

		// Use Better Auth's internal API to generate verification token and send email
		try {
			const baseURL = config.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
			const { sendEmailVerification } = await import('@/lib/api/email.service');
			
			// Generate a verification token (Better Auth format)
			const crypto = await import('crypto');
			const token = crypto.randomBytes(32).toString('hex');
			
			// Store the token in Better Auth's verification collection
			// Better Auth uses 'verifications' collection with specific schema
			const mongoose = await import('mongoose');
			
			// Check if model exists, otherwise create it
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
			await Verification.deleteMany({ userId: context.userId });
			
			// Create new verification token (expires in 24 hours)
			const expiresAt = new Date();
			expiresAt.setHours(expiresAt.getHours() + 24);
			await Verification.create({
				userId: context.userId,
				token,
				expiresAt,
			});
			
			const verificationUrl = `${baseURL}/auth/verify-email/confirm?token=${token}`;
			
			await sendEmailVerification({
				email: user.email,
				name: user.name || user.firstName || 'User',
				verificationLink: verificationUrl,
			});

			logger.info('Verification email resent', {
				userId: context.userId.toString(),
				email: user.email,
			});

			return NextResponse.json(
				{
					code: 'Success',
					message: 'Verification email sent successfully. Please check your inbox.',
				},
				{ status: 200 }
			);
		} catch (emailError: any) {
			logger.error('Error sending verification email', {
				error: emailError.message,
				userId: context.userId.toString(),
			});
			throw emailError;
		}
	} catch (error: any) {
		logger.error('Error resending verification email', error);
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

export const POST = withAuth(handler);

