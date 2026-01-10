// POST /api/v1/users/set-role
// Set user role after registration (internal use only)
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import User from '@/models/user';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['user', 'admin', 'tutor'];
    const userRole = role || 'user';
    
    if (!validRoles.includes(userRole)) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Invalid role' },
        { status: 400 }
      );
    }

    // Only allow setting 'user' role for self-registration
    // Admin and tutor roles require admin action
    if (userRole !== 'user') {
      return NextResponse.json(
        { code: 'Forbidden', message: 'Cannot self-assign admin or tutor role' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // Update user role
    const result = await User.findByIdAndUpdate(
      userId,
      { $set: { role: userRole } },
      { new: true }
    ).exec();

    if (!result) {
      return NextResponse.json(
        { code: 'NotFoundError', message: 'User not found' },
        { status: 404 }
      );
    }

    logger.info('User role set successfully', {
      userId,
      role: userRole,
    });

    return NextResponse.json(
      { code: 'Success', message: 'Role set successfully', role: userRole },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error setting user role', {
      error: error.message,
    });
    return NextResponse.json(
      { code: 'ServerError', message: 'Failed to set user role' },
      { status: 500 }
    );
  }
}

