// Middleware for Next.js API routes
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getAuth } from './better-auth';
import { logger } from './logger';
import { fromNodeHeaders } from 'better-auth/node';
import { connectToDatabase } from './db';

// Extend NextRequest to include user info
export interface AuthenticatedRequest extends NextRequest {
	userId?: Types.ObjectId;
	userRole?: 'admin' | 'user' | 'tutor';
}

/**
 * Validate Bearer token from mobile app
 */
async function validateBearerToken(token: string): Promise<{ userId: Types.ObjectId; userRole: 'admin' | 'user' | 'tutor' } | null> {
	try {
		const mongoose = await connectToDatabase();
		const db = mongoose.connection.db;

		if (!db) {
			logger.error('Database connection not available for Bearer token validation');
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

		// Handle userId as string or ObjectId
		let userId: Types.ObjectId;
		if (typeof session.userId === 'string') {
			try {
				userId = new Types.ObjectId(session.userId);
			} catch (error) {
				logger.error('Failed to convert userId string to ObjectId', {
					userId: session.userId,
					error: error instanceof Error ? error.message : String(error),
				});
				return null;
			}
		} else if (session.userId instanceof Types.ObjectId) {
			userId = session.userId;
		} else if (session.userId && typeof session.userId === 'object' && 'toString' in session.userId) {
			// Handle MongoDB ObjectId wrapper
			userId = new Types.ObjectId(session.userId.toString());
		} else {
			// Try to convert
			try {
				userId = new Types.ObjectId(String(session.userId));
			} catch (error) {
				logger.error('Failed to convert userId to ObjectId', {
					userId: session.userId,
					userIdType: typeof session.userId,
					error: error instanceof Error ? error.message : String(error),
				});
				return null;
			}
		}

		logger.info('Looking up user with userId', {
			userId: userId.toString(),
			userIdType: typeof session.userId,
		});

		// Get user from session - try both ObjectId and string
		const user = await usersCollection.findOne({
			$or: [
				{ _id: userId },
				{ _id: new Types.ObjectId(String(session.userId)) },
			],
		});

		if (!user) {
			logger.warn('User not found for session userId:', userId);
			return null;
		}

		// Normalize role (handle legacy "learner" role)
		let userRole = (user.role as 'admin' | 'user' | 'tutor' | 'learner') || 'user';
		if (userRole === 'learner') {
			userRole = 'user';
		}

		logger.info('Bearer token validated successfully', {
			userId: userId.toString(),
			userRole,
		});

		return {
			userId: new Types.ObjectId(user._id),
			userRole: userRole as 'admin' | 'user' | 'tutor',
		};
	} catch (error: any) {
		logger.error('Error validating Bearer token', {
			error: error.message,
			stack: error.stack,
		});
		return null;
	}
}

/**
 * Better Auth authentication middleware for Next.js API routes
 * Supports both cookie-based (web) and Bearer token (mobile) authentication
 */
export const requireAuth = async (
	req: NextRequest
): Promise<{ userId: Types.ObjectId; userRole: 'admin' | 'user' | 'tutor' } | NextResponse> => {
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

		// Return userId and userRole
		return {
			userId: new Types.ObjectId(session.user.id),
			userRole: userRole as 'admin' | 'user' | 'tutor',
		};
	} catch (error: any) {
		logger.error('Error in requireAuth middleware', {
			error: error.message,
			stack: error.stack,
		});
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
	handler: (req: NextRequest, context: T & { userId: Types.ObjectId; userRole: string }) => Promise<NextResponse>
) => {
	return async (req: NextRequest, context?: any) => {
		const authResult = await requireAuth(req);
		if (authResult instanceof NextResponse) {
			return authResult; // Error response
		}
		return handler(req, { ...context, ...authResult });
	};
};

// Helper to create role-protected API handler
export const withRole = <T = any>(
	allowedRoles: string[],
	handler: (req: NextRequest, context: T & { userId: Types.ObjectId; userRole: string }) => Promise<NextResponse>
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


