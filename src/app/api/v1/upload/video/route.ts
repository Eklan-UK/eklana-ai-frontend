import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { uploadToCloudinary } from '@/services/cloudinary.service';
import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';

// Increase timeout for video uploads
export const maxDuration = 300; // 5 minutes

// POST /api/v1/upload/video - Upload video to Cloudinary
async function uploadVideo(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    logger.info('📤 Video upload request received', {
      userId: context.userId.toString(),
      contentType: req.headers.get('content-type'),
    });

    const formData = await req.formData();
    const file = formData.get('video') as File;

    if (!file) {
      logger.warn('❌ No video file provided in upload request');
      return NextResponse.json(
        { code: 'ValidationError', message: 'No video file provided' },
        { status: 400 }
      );
    }

    // Check file size (limit to 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    
    logger.info('📊 Video file info:', {
      name: file.name,
      size: file.size,
      sizeMB: fileSizeMB,
      type: file.type,
    });

    if (file.size > maxSize) {
      logger.warn('❌ Video file too large:', {
        size: file.size,
        maxSize,
        sizeMB: fileSizeMB,
      });
      return NextResponse.json(
        { code: 'ValidationError', message: 'Video file is too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    logger.info('🔄 Converting file to buffer...');
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info('✅ Buffer created, starting Cloudinary upload...', {
      bufferSize: buffer.length,
      bufferSizeMB: (buffer.length / 1024 / 1024).toFixed(2),
    });

    // Upload to Cloudinary with increased timeout
    const result = await uploadToCloudinary(buffer, {
      folder: `eklan/future-self/${context.userId}`,
      resourceType: 'video',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    logger.info('✅ Video uploaded successfully:', {
      publicId: result.publicId,
      url: result.secureUrl,
    });

    return NextResponse.json({
      code: 'Success',
      url: result.secureUrl,
      publicId: result.publicId,
    });
  } catch (error: any) {
    logger.error('❌ Error uploading video:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      userId: context.userId.toString(),
      errorType: typeof error,
      errorKeys: Object.keys(error),
    });
    
    // Return detailed error information
    return NextResponse.json(
      { 
        code: 'UploadError',
        message: error.message || 'Failed to upload video',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(uploadVideo);

