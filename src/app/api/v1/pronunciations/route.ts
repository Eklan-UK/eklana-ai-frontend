// GET /api/v1/pronunciations - Get all pronunciations (admin)
// POST /api/v1/pronunciations - Create a new pronunciation (admin)
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import { parseQueryParams } from '@/lib/api/query-parser';
import { apiResponse } from '@/lib/api/response';
import { PronunciationService } from '@/domain/pronunciations/pronunciation.service';
import { PronunciationRepository } from '@/domain/pronunciations/pronunciation.repository';
import { PronunciationAssignmentRepository } from '@/domain/pronunciations/pronunciation-assignment.repository';
import { PronunciationAttemptRepository } from '@/domain/pronunciations/pronunciation-attempt.repository';

// GET handler - Get all pronunciations
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
) {
	await connectToDatabase();

	const queryParams = parseQueryParams(req);
	const pronunciationRepo = new PronunciationRepository();
	const assignmentRepo = new PronunciationAssignmentRepository();
	const attemptRepo = new PronunciationAttemptRepository();
	const pronunciationService = new PronunciationService(pronunciationRepo, assignmentRepo, attemptRepo);

	const searchParams = new URL(req.url).searchParams;
	const isActiveParam = searchParams.get('isActive');
	
	const result = await pronunciationService.listPronunciations({
		difficulty: queryParams.difficulty as 'beginner' | 'intermediate' | 'advanced' | undefined,
		isActive: isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined,
		search: queryParams.search,
		limit: queryParams.limit,
		offset: queryParams.offset,
	});

	return apiResponse.success({
		pronunciations: result.pronunciations,
		pagination: {
			total: result.total,
			limit: result.limit,
			offset: result.offset,
			hasMore: result.offset + result.pronunciations.length < result.total,
		},
	});
}

// POST handler - Create pronunciation
async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
) {
	await connectToDatabase();

	// Parse form data
	const formData = await req.formData();
	const title = formData.get('title') as string;
	const description = formData.get('description') as string | null;
	const text = formData.get('text') as string;
	const phonetic = formData.get('phonetic') as string | null;
	const difficulty = (formData.get('difficulty') as string) || 'intermediate';
	const tags = formData.get('tags') as string | null;
	const audioFile = formData.get('audio') as File | null;

	// Parse tags if provided
	let tagsArray: string[] = [];
	if (tags) {
		tagsArray = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
	}

	const pronunciationRepo = new PronunciationRepository();
	const assignmentRepo = new PronunciationAssignmentRepository();
	const attemptRepo = new PronunciationAttemptRepository();
	const pronunciationService = new PronunciationService(pronunciationRepo, assignmentRepo, attemptRepo);

	const pronunciation = await pronunciationService.createPronunciation(
		{
			title,
			description: description || undefined,
			text,
			phonetic: phonetic || undefined,
			difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
			tags: tagsArray,
			audioFile: audioFile || undefined,
		},
		context.userId.toString()
	);

	return apiResponse.success({ pronunciation }, 201);
}

export const GET = withRole(['admin'], withErrorHandler(getHandler));
export const POST = withRole(['admin'], withErrorHandler(postHandler));
