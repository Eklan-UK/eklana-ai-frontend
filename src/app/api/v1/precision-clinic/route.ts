// GET  /api/v1/precision-clinic — list + filters + stats
// POST /api/v1/precision-clinic — create
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { parseRequestBody } from '@/lib/api/request-parser';
import { parseQueryParams } from '@/lib/api/query-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import User from '@/models/user';
import {
	PrecisionClinicRepository,
	PrecisionClinicService,
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DIFFICULTIES,
	type PrecisionClinicDrillType,
	type PrecisionClinicDifficulty,
	type PrecisionClinicPublishStatus,
} from '@/domain/precision-clinic';
import { createPrecisionClinicSchema } from '@/domain/precision-clinic/precision-clinic.validation';

function parseClinicFilters(req: NextRequest) {
	const queryParams = parseQueryParams(req);
	const { searchParams } = new URL(req.url);

	const typeRaw = searchParams.get('type') ?? queryParams.type;
	const type =
		typeof typeRaw === 'string' &&
		(PRECISION_CLINIC_DRILL_TYPES as readonly string[]).includes(typeRaw)
			? (typeRaw as PrecisionClinicDrillType)
			: undefined;

	const difficultyRaw =
		searchParams.get('difficulty') ?? queryParams.difficulty;
	const difficulty =
		typeof difficultyRaw === 'string' &&
		(PRECISION_CLINIC_DIFFICULTIES as readonly string[]).includes(
			difficultyRaw
		)
			? (difficultyRaw as PrecisionClinicDifficulty)
			: undefined;

	const statusRaw = searchParams.get('status') ?? queryParams.status;
	const status =
		statusRaw === 'published' || statusRaw === 'draft'
			? (statusRaw as PrecisionClinicPublishStatus)
			: undefined;

	const includeArchived =
		searchParams.get('includeArchived') === 'true' ||
		queryParams.includeArchived === true;

	const isArchivedParam = searchParams.get('isArchived');
	const isArchived =
		isArchivedParam === 'true'
			? true
			: isArchivedParam === 'false'
				? false
				: undefined;

	return {
		q: (searchParams.get('q') ?? queryParams.q) || undefined,
		type,
		difficulty,
		status,
		includeArchived: includeArchived || undefined,
		isArchived,
		limit: queryParams.limit,
		offset: queryParams.offset,
	};
}

async function getHandler(
	req: NextRequest,
	_context: { userId: string; userRole: string }
) {
	await connectToDatabase();

	const filters = parseClinicFilters(req);
	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);
	const result = await service.list(filters);

	return apiResponse.success({
		drills: result.drills,
		total: result.total,
		limit: result.limit,
		offset: result.offset,
		stats: result.stats,
	});
}

async function postHandler(
	req: NextRequest,
	context: { userId: string; userRole: string }
) {
	await connectToDatabase();

	const body = await parseRequestBody(req);
	const validated = validateRequest(createPrecisionClinicSchema, body);

	const creator = await User.findById(context.userId)
		.select('email')
		.lean()
		.exec();

	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);

	const drill = await service.create(
		{
			title: validated.title,
			type: validated.type,
			difficulty: validated.difficulty,
			context: validated.context,
			completionDate: validated.completionDate,
			durationDays: validated.durationDays,
			preGenerateAudio: validated.preGenerateAudio,
			ttsVoiceKey: validated.ttsVoiceKey,
			assignedLearnerIds: validated.assignedLearnerIds,
			soundGroups: validated.soundGroups,
			questions: validated.questions,
			pairs: validated.pairs,
			patterns: validated.patterns,
			words: validated.words,
			contentTitle: validated.contentTitle,
			content: validated.content,
			articleTitle: validated.articleTitle,
			articleContent: validated.articleContent,
		},
		{
			userId: context.userId.toString(),
			email: (creator as { email?: string } | null)?.email,
		}
	);

	return apiResponse.success({ drill }, 201);
}

export const GET = withRole(
	['admin'],
	withErrorHandler(getHandler)
);
export const POST = withRole(
	['admin'],
	withErrorHandler(postHandler)
);
