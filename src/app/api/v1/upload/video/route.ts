import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { uploadToCloudinary } from '@/services/cloudinary.service';
import { Types } from 'mongoose';

// Increase timeout for video uploads
export const maxDuration = 300; // 5 minutes

// POST /api/v1/upload/video - Upload video to Cloudinary
async function uploadVideo(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File;

    if (!file) {
      return NextResponse.json(
        { message: 'No video file provided' },
        { status: 400 }
      );
    }

    // Check file size (limit to 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: 'Video file is too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    console.log(`Uploading video: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('Buffer created, starting Cloudinary upload...');

    // Upload to Cloudinary with increased timeout
    const result = await uploadToCloudinary(buffer, {
      folder: `eklan/future-self/${context.userId}`,
      resourceType: 'video',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    console.log('Video uploaded successfully:', result.publicId);

    return NextResponse.json({
      url: result.secureUrl,
      publicId: result.publicId,
    });
  } catch (error: any) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { message: 'Failed to upload video', error: error.message },
      { status: 500 }
    );
  }
}

export const POST = withAuth(uploadVideo);

