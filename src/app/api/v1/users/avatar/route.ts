// POST /api/v1/users/avatar
// Upload user avatar image to Cloudinary
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '@/services/cloudinary.service';
import { logger } from '@/lib/api/logger';

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    // Get form data
    const formData = await req.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Avatar file is required',
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Only image files are allowed',
        },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          code: 'ValidationError',
          message: 'Image size must be less than 5MB',
        },
        { status: 400 }
      );
    }

    // Get current user to check for existing avatar
    const user = await User.findById(context.userId);
    if (!user) {
      return NextResponse.json(
        {
          code: 'NotFoundError',
          message: 'User not found',
        },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(buffer, {
      folder: 'eklan/users/avatars',
      publicId: `avatar_${context.userId}`,
      resourceType: 'image',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    // Delete old avatar from Cloudinary if exists
    if (user.avatar) {
      try {
        const oldPublicId = extractPublicIdFromUrl(user.avatar);
        if (oldPublicId && oldPublicId !== uploadResult.publicId) {
          await deleteFromCloudinary(oldPublicId);
          logger.info('Old avatar deleted from Cloudinary', { publicId: oldPublicId });
        }
      } catch (error: any) {
        // Log but don't fail if deletion fails
        logger.warn('Failed to delete old avatar', { error: error.message });
      }
    }

    // Update user avatar in database
    user.avatar = uploadResult.secureUrl;
    user.image = uploadResult.secureUrl; // Also update image field for Better Auth compatibility
    await user.save();

    logger.info('Avatar uploaded successfully', {
      userId: context.userId,
      avatarUrl: uploadResult.secureUrl,
    });

    return NextResponse.json(
      {
        code: 'Success',
        message: 'Avatar uploaded successfully',
        data: {
          avatarUrl: uploadResult.secureUrl,
          publicId: uploadResult.publicId,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error uploading avatar', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        code: 'ServerError',
        message: error.message || 'Failed to upload avatar',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

