// Middleware for Next.js API routes
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getAuth } from './better-auth';
import { logger } from './logger';
import { fromNodeHeaders } from 'better-auth/node';

// Extend NextRequest to include user info
export interface AuthenticatedRequest extends NextRequest {
	userId?: Types.ObjectId;
	userRole?: 'admin' | 'user' | 'tutor';
}

/**
 * Better Auth authentication middleware for Next.js API routes
 * Supports both cookie-based (web) and Bearer token (mobile) authentication
 */
export const requireAuth = async (
	req: NextRequest
): Promise<{ userId: Types.ObjectId; userRole: 'admin' | 'user' | 'tutor' } | NextResponse> => {
	try {
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

		// Check for Bearer token (mobile apps)
		const authHeader = req.headers.get('authorization');
		logger.info('Auth middleware check', {
			hasAuthHeader: !!authHeader,
			authHeaderPrefix: authHeader?.substring(0, 10),
			url: req.url,
		});
		
		if (authHeader?.startsWith('Bearer ')) {
			const token = authHeader.substring(7);
			logger.info('Processing Bearer token', {
				tokenLength: token.length,
				tokenPrefix: token.substring(0, 20) + '...',
			});
			
			try {
				// Query session directly from database using the token
				const mongoose = await import('mongoose');
				const db = mongoose.default.connection.db;
				
				if (db) {
					const sessionsCollection = db.collection('sessions');
					
					logger.info('Querying sessions collection', {
						token: token.substring(0, 20) + '...',
					});
					
					const session = await sessionsCollection.findOne({
						token: token,
						expiresAt: { $gt: new Date() }, // Check if not expired
					});

					logger.info('Session query result', {
						found: !!session,
						hasUserId: !!session?.userId,
						expiresAt: session?.expiresAt,
					});

					if (session && session.userId) {
						// Get user data
						const usersCollection = db.collection('users');
						const user = await usersCollection.findOne({
							_id: new Types.ObjectId(session.userId),
						});

						logger.info('User query result', {
							found: !!user,
							userId: user?._id?.toString(),
							role: user?.role,
						});

						if (user) {
							// Normalize role
							let userRole = (user.role as 'admin' | 'user' | 'tutor' | 'learner') || 'user';
							if (userRole === 'learner') {
								userRole = 'user';
							}

							logger.info('Bearer token authentication successful', {
								userId: user._id.toString(),
								userRole,
							});

							return {
								userId: new Types.ObjectId(user._id),
								userRole: userRole as 'admin' | 'user' | 'tutor',
							};
						}
					}
				}
				
				logger.warn('Bearer token validation failed - session not found or expired');
			} catch (tokenError) {
				logger.error('Bearer token verification error', {
					error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
					stack: tokenError instanceof Error ? tokenError.stack : undefined,
				});
				// Fall through to cookie-based auth
			}
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


