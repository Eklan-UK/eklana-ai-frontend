// GET /api/v1/admin/confidence/[learnerId]
// Admin/tutor: fetch and recompute confidence metrics for any learner
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { apiResponse } from '@/lib/api/response';
import { computeConfidenceMetrics } from '@/domain/confidence/confidence.service';

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { learnerId: string }
): Promise<NextResponse> {
  await connectToDatabase();

  const { learnerId } = params;

  if (!Types.ObjectId.isValid(learnerId)) {
    return NextResponse.json(
      { code: 'ValidationError', message: 'Invalid learner ID' },
      { status: 400 }
    );
  }

  const metrics = await computeConfidenceMetrics(learnerId);

  return NextResponse.json({ code: 'Success', data: { confidence: metrics } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ learnerId: string }> }
) {
  const resolvedParams = await params;
  return withRole(['admin', 'tutor'], (req, context) =>
    handler(req, context, resolvedParams)
  )(req);
}
