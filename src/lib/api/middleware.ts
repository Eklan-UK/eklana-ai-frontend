// Middleware for Next.js API routes
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getAuth } from './better-auth';
import { logger } from './logger';
import { fromNodeHeaders } from 'better-auth/node';
import { connectToDatabase } from './db';
import { isUserSubscribed } from './user-subscription';
import { toRawUserIdFilter } from './user-id';
import User from '@/models/user';

// Extend NextRequest to include user info
//
// userId is a string, not Types.ObjectId. Better Auth (web sign-up, incl.
// Google/Apple OAuth) assigns UUID string user ids; legacy/mobile accounts
// use ObjectId hex strings. Callers that need a Mongoose query value should
// use toUserIdQuery()/toUserIdQueryMulti() from './user-id'.
export interface AuthenticatedRequest extends NextRequest {
	userId?: string;
	userRole?: 'admin' | 'user' | 'tutor';
}

/**
 * Validate Bearer token from mobile app
 */
async function validateBearerToken(token: string): Promise<{ userId: string; userRole: 'admin' | 'user' | 'tutor' } | null> {
	const maxRetries = 2;
	let lastError: Error | null = null;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const mongoose = await connectToDatabase();
			const db = mongoose.connection.db;

			if (!db) {
				logger.error('Database connection not available for Bearer token validation');
				if (attempt < maxRetries) {
					await new Promise(resolve => setTimeout(resolve, 500 * attempt));
					continue;
				}
				return null;
			}

			// Verify connection is ready
			if (mongoose.connection.readyState !== 1) {
				logger.warn(`MongoDB connection not ready (state: ${mongoose.connection.readyState}), retrying...`);
				if (attempt < maxRetries) {
					await new Promise(resolve => setTimeout(resolve, 500 * attempt));
					continue;
				}
				return null;
			}

		const sessionsCollection = db.collection('sessions');
		const usersCollection = db.collection('users');

		// Find session by token
		// Better Auth might use 'id' or 'token' field, we use 'sessionToken'
		// Try multiple field names to be compatible
		const session = await sessionsCollection.findOne({
			$or: [
				{ sessionToken: token },
				{ id: token },
				{ token: token },
			],
			expiresAt: { $gt: new Date() }, // Session not expired
		});

		if (!session) {
			logger.warn('Session not found or expired for Bearer token', {
				tokenLength: token.length,
				tokenPrefix: token.substring(0, 10),
			});
			
			// Debug: Check if any sessions exist
			const totalSessions = await sessionsCollection.countDocuments({});
			logger.info('Total sessions in database:', totalSessions);
			
			return null;
		}

		logger.info('Session found for Bearer token', {
			sessionId: session._id,
			userId: session.userId,
			expiresAt: session.expiresAt,
		});

		// Normalize session.userId to a plain string. Better Auth (web
		// sign-up, incl. Google/Apple OAuth) stores UUID string user ids;
		// legacy/mobile accounts store ObjectId hex strings or BSON
		// ObjectId instances. We no longer force-cast to Types.ObjectId
		// here — that throws for UUID users and previously caused this
		// function to return null (401) for every UUID-keyed session.
		let rawUserId: string;
		if (typeof session.userId === 'string') {
			rawUserId = session.userId;
		} else if (session.userId instanceof Types.ObjectId) {
			rawUserId = session.userId.toString();
		} else if (session.userId && typeof session.userId === 'object' && 'toString' in session.userId) {
			rawUserId = session.userId.toString();
		} else {
			rawUserId = String(session.userId);
		}

		logger.info('Looking up user with userId', {
			userId: rawUserId,
			userIdType: typeof session.userId,
		});

		// Query the raw `users` collection directly (not via the Mongoose
		// model) so the lookup works whether _id is a UUID string or an
		// ObjectId, without any Mongoose/BSON cast attempt. The MongoDB
		// driver's Filter<Document> type infers `_id` as ObjectId-only when
		// the collection has no explicit schema, so `as any` is required
		// here to intentionally allow both id shapes.
		const user = await usersCollection.findOne(toRawUserIdFilter(rawUserId) as any);

		if (!user) {
			logger.warn('User not found for session userId:', rawUserId);
			return null;
		}

		// Normalize role (handle legacy "learner" role)
		let userRole = (user.role as 'admin' | 'user' | 'tutor' | 'learner') || 'user';
		if (userRole === 'learner') {
			userRole = 'user';
		}

			const resolvedUserId = user._id.toString();

			logger.info('Bearer token validated successfully', {
				userId: resolvedUserId,
				userRole,
			});

			return {
				userId: resolvedUserId,
				userRole: userRole as 'admin' | 'user' | 'tutor',
			};
		} catch (error: any) {
			lastError = error;
			// Check if it's a connection error that we can retry
			const isConnectionError = error.message?.includes('connection') || 
			                          error.message?.includes('closed') ||
			                          error.message?.includes('MongoServerSelectionError');
			
			if (isConnectionError && attempt < maxRetries) {
				logger.warn(`Bearer token validation attempt ${attempt}/${maxRetries} failed (connection error), retrying...`, {
					error: error.message,
				});
				await new Promise(resolve => setTimeout(resolve, 500 * attempt));
				continue;
			}
			
			// Non-retryable error or max retries reached
			logger.error('Error validating Bearer token', {
				error: error.message,
				stack: error.stack,
				attempt,
			});
			if (attempt === maxRetries) {
				return null;
			}
		}
	}
	
	// All retries failed
	logger.error('Bearer token validation failed after all retries', {
		error: lastError?.message,
	});
	return null;
}

/**
 * Better Auth authentication middleware for Next.js API routes
 * Supports both cookie-based (web) and Bearer token (mobile) authentication
 */
export const requireAuth = async (
	req: NextRequest
): Promise<{ userId: string; userRole: 'admin' | 'user' | 'tutor' } | NextResponse> => {
	try {
		// First, check for Bearer token (mobile app)
		const authHeader = req.headers.get('authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix and trim whitespace
			
			if (token) {
				logger.info('Bearer token found in request, validating...', {
					tokenLength: token.length,
					tokenPrefix: token.substring(0, 20),
					url: req.url,
				});
				const bearerAuth = await validateBearerToken(token);
				
				if (bearerAuth) {
					logger.info('Bearer token validated successfully', {
						userId: bearerAuth.userId.toString(),
						userRole: bearerAuth.userRole,
					});
					return bearerAuth;
				} else {
					logger.warn('Bearer token validation failed', {
						tokenLength: token.length,
					});
					// For mobile requests with Bearer tokens, don't fall back to cookies
					// Mobile apps don't use cookies, so return 401 immediately
					return NextResponse.json(
						{
							code: 'AuthenticationError',
							message: 'Not authenticated. Please log in.',
						},
						{ status: 401 }
					);
				}
			} else {
				logger.warn('Bearer token is empty');
			}
		}

		// Fall back to Better Auth cookie-based session (web)
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

		// Try cookie-based session (web apps)
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(Object.fromEntries(req.headers.entries())),
		});

		if (!session || !session.user) {
			return NextResponse.json(
				{
					code: 'AuthenticationError',
					message: 'Not authenticated. Please log in.',
				},
				{ status: 401 }
			);
		}

		// Normalize role (handle legacy "learner" role)
		let userRole = (session.user.role as 'admin' | 'user' | 'tutor' | 'learner') || 'user';
		if (userRole === 'learner') {
			userRole = 'user';
		}

		// Return userId and userRole. session.user.id is a UUID string for
		// Better Auth web accounts (incl. Google/Apple OAuth) or an ObjectId
		// hex string for legacy accounts — kept as a plain string rather than
		// force-cast to Types.ObjectId, which throws for UUID users.
		return {
			userId: session.user.id,
			userRole: userRole as 'admin' | 'user' | 'tutor',
		};
	} catch (error: any) {
		logger.error('Error in requireAuth middleware', {
			error: error.message,
			stack: error.stack,
		});

		// Distinguish infrastructure failures (DB down, DNS, timeout) from genuine
		// auth failures. Returning 401 for infra errors misleads clients into thinking
		// the user is logged out, when in fact the session lookup simply couldn't run.
		const isInfraError =
			error.message?.includes('Failed to get session') ||
			error.message?.includes('MongoServerSelectionError') ||
			error.message?.includes('MongoNetworkError') ||
			error.message?.includes('EAI_AGAIN') ||
			error.message?.includes('ECONNREFUSED') ||
			error.message?.includes('getaddrinfo') ||
			error.name === 'MongoServerSelectionError' ||
			error.name === 'MongoNetworkError';

		if (isInfraError) {
			return NextResponse.json(
				{
					code: 'ServiceUnavailable',
					message: 'Authentication service is temporarily unavailable. Please try again in a moment.',
				},
				{ status: 503 }
			);
		}

		return NextResponse.json(
			{
				code: 'AuthenticationError',
				message: 'Authentication failed',
			},
			{ status: 401 }
		);
	}
};

/**
 * Better Auth authorization middleware for Next.js API routes
 */
export const requireRole = (allowedRoles: string[]) => {
	return (userRole: string): boolean => {
		return allowedRoles.includes(userRole);
	};
};

// Helper to create authenticated API handler
export const withAuth = <T = any>(
	handler: (req: NextRequest, context: T & { userId: string; userRole: string }) => Promise<NextResponse>
) => {
	return async (req: NextRequest, context?: any) => {
		const authResult = await requireAuth(req);
		if (authResult instanceof NextResponse) {
			return authResult; // Error response
		}
		return handler(req, { ...context, ...authResult });
	};
};

// Helper to create subscription-gated API handler (requires active premium plan)
export const withPremium = <T = any>(
	handler: (req: NextRequest, context: T & { userId: string; userRole: string }) => Promise<NextResponse>
) => {
	return withAuth<T>(async (req, context) => {
		await connectToDatabase();
		// User._id uses a custom SchemaType (see src/models/user.ts) that casts
		// ObjectId-shaped strings to real ObjectIds for both formats, so
		// findById works unmodified for both legacy ObjectId and UUID ids.
		const user = await User.findById(context.userId)
			.select(
				'subscriptionPlan subscriptionExpiresAt stripeSubscriptionStatus subscriptionPaymentMethod appleSubscriptionStatus appleOriginalTransactionId'
			)
			.lean()
			.exec();
		if (!user || !isUserSubscribed(user as any)) {
			return NextResponse.json(
				{
					code: 'SubscriptionRequired',
					message: 'A Pro subscription is required to access this feature.',
				},
				{ status: 402 }
			);
		}
		return handler(req, context);
	});
};

// Helper to create role-protected API handler
export const withRole = <T = any>(
	allowedRoles: string[],
	handler: (req: NextRequest, context: T & { userId: string; userRole: string }) => Promise<NextResponse>
) => {
	return async (req: NextRequest, context?: any) => {
		const authResult = await requireAuth(req);
		if (authResult instanceof NextResponse) {
			return authResult; // Error response
		}

		if (!allowedRoles.includes(authResult.userRole)) {
			return NextResponse.json(
				{
					code: 'Forbidden',
					message: "You don't have permission to access this resource",
				},
				{ status: 403 }
			);
		}

		return handler(req, { ...context, ...authResult });
	};
};


