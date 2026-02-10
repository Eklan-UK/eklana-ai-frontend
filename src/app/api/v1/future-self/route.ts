import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import FutureSelf from '@/models/future-self';
import { z } from 'zod';
import { Types } from 'mongoose';

const createFutureSelfSchema = z.object({
  videoUrl: z.string().url(),
  publicId: z.string(),
  duration: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
});

// GET /api/v1/future-self - Get all future self videos for the current user
async function getFutureSelfVideos(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    await connectToDatabase();
    
    const videos = await FutureSelf.find({ userId: context.userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ videos });
  } catch (error: any) {
    console.error('Error fetching future self videos:', error);
    return NextResponse.json(
      { message: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

// POST /api/v1/future-self - Create or update a future self video (only one per user)
async function createFutureSelfVideo(req: NextRequest, context: { userId: Types.ObjectId; userRole: string }) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const result = createFutureSelfSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.issues },
        { status: 400 }
      );
    }

    // Check if user already has a future self video
    const existingVideo = await FutureSelf.findOne({ userId: context.userId });

    if (existingVideo) {
      // Delete old video from Cloudinary
      const { deleteFromCloudinary } = await import('@/services/cloudinary.service');
      try {
        await deleteFromCloudinary(existingVideo.publicId);
      } catch (error) {
        console.error('Error deleting old video from Cloudinary:', error);
        // Continue with update even if Cloudinary deletion fails
      }

      // Update existing video
      const video = await FutureSelf.findOneAndUpdate(
        { userId: context.userId },
        {
          ...result.data,
          updatedAt: new Date(),
        },
        { new: true }
      );

      return NextResponse.json({ video }, { status: 200 });
    } else {
      // Create new video
      const video = await FutureSelf.create({
        userId: context.userId,
        ...result.data,
      });

      return NextResponse.json({ video }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error creating/updating future self video:', error);
    
    // Handle unique constraint violation
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      return NextResponse.json(
        { message: 'You already have a future self video. It will be updated.' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Failed to create/update video' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getFutureSelfVideos);
export const POST = withAuth(createFutureSelfVideo);





