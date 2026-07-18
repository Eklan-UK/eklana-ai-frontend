// GET /api/v1/drills/bookmarked - List bookmarked drills (shared admin library)
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { parseQueryParams } from '@/lib/api/query-parser';
import { apiResponse } from '@/lib/api/response';
import { DrillService } from '@/domain/drills/drill.service';
import { DrillRepository } from '@/domain/drills/drill.repository';
import { AssignmentRepository } from '@/domain/assignments/assignment.repository';
import { AttemptRepository } from '@/domain/attempts/attempt.repository';

async function getHandler(req: NextRequest) {
  await connectToDatabase();

  const queryParams = parseQueryParams(req);

  const drillRepo = new DrillRepository();
  const assignmentRepo = new AssignmentRepository();
  const attemptRepo = new AttemptRepository();
  const drillService = new DrillService(drillRepo, assignmentRepo, attemptRepo);

  const result = await drillService.listDrills({
    isBookmarked: true,
    type: queryParams.type,
    difficulty: queryParams.difficulty,
    q: queryParams.q,
    learningJourneyPart: queryParams.learningJourneyPart,
    learningJourneyTopic: queryParams.learningJourneyTopic,
    isActive: queryParams.isActive,
    limit: queryParams.limit,
    offset: queryParams.offset,
  });

  return apiResponse.success({
    drills: result.drills,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}

export const GET = withRole(['admin', 'tutor'], withErrorHandler(getHandler));
