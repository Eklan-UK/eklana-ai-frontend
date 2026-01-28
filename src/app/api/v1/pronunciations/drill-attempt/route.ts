// POST /api/v1/pronunciations/drill-attempt
// Create a pronunciation attempt from a drill (standalone, not linked to assignment)
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { z } from 'zod';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import { PronunciationService } from '@/domain/pronunciations/pronunciation.service';
import { PronunciationRepository } from '@/domain/pronunciations/pronunciation.repository';
import { PronunciationAssignmentRepository } from '@/domain/pronunciations/pronunciation-assignment.repository';
import { PronunciationAttemptRepository } from '@/domain/pronunciations/pronunciation-attempt.repository';

const drillAttemptSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  audioBase64: z.string().min(1, 'Audio recording is required'),
  drillId: z.string().refine((id) => Types.ObjectId.isValid(id), {
    message: 'Drill ID must be a valid MongoDB ObjectId',
  }).optional(),
  drillAttemptId: z.string().refine((id) => Types.ObjectId.isValid(id), {
    message: 'Drill attempt ID must be a valid MongoDB ObjectId',
  }).optional(),
  drillType: z.enum(['vocabulary', 'roleplay', 'sentence', 'other']).optional(),
  passingThreshold: z.number().min(0).max(100).optional().default(70),
});

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string }
) {
  await connectToDatabase();

  const body = await parseRequestBody(req);
  const validated = validateRequest(drillAttemptSchema, body);

  const pronunciationRepo = new PronunciationRepository();
  const assignmentRepo = new PronunciationAssignmentRepository();
  const attemptRepo = new PronunciationAttemptRepository();
  const pronunciationService = new PronunciationService(
    pronunciationRepo,
    assignmentRepo,
    attemptRepo
  );

  const result = await pronunciationService.createDrillPronunciationAttempt({
    learnerId: context.userId.toString(),
    text: validated.text,
    audioBase64: validated.audioBase64,
    drillId: validated.drillId,
    drillAttemptId: validated.drillAttemptId,
    drillType: validated.drillType,
    passingThreshold: validated.passingThreshold,
  });

  return apiResponse.success({ attempt: result }, 201);
}

export async function POST(req: NextRequest) {
  return withAuth(withErrorHandler(handler))(req);
}

