import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import FutureSelf from '@/models/future-self';
import { deleteFromCloudinary } from '@/services/cloudinary.service';
import { Types } from 'mongoose';

// DELETE /api/v1/future-self/[id] - Delete a future self video
async function deleteFutureSelfVideo(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string; params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    
    const video = await FutureSelf.findOne({
      _id: id,
      userId: context.userId,
    });

    if (!video) {
      return NextResponse.json(
        { message: 'Video not found' },
        { status: 404 }
      );
    }

    // Delete from Cloudinary
    try {
      await deleteFromCloudinary(video.publicId);
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    await FutureSelf.deleteOne({ _id: id });

    return NextResponse.json({ message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting future self video:', error);
    return NextResponse.json(
      { message: 'Failed to delete video' },
      { status: 500 }
    );
  }
}

export const DELETE = withAuth(deleteFutureSelfVideo);





