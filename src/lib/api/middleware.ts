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

		// Get session from Better Auth using request headers
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
export const withAuth = (
	handler: (req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) => Promise<NextResponse>
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
export const withRole = (
	allowedRoles: string[],
	handler: (req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) => Promise<NextResponse>
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


