// GET/POST/DELETE /api/v1/learner/weekly-challenge/[weekStartDate]/items/[index]/checkpoint
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse, NotFoundError, ValidationError } from '@/lib/api/response';
import WeeklyChallengeModel from '@/models/weekly-challenge';

type AuthContext = { userId: Types.ObjectId; userRole: string };
type Params = { weekStartDate: string; index: string };

const postBodySchema = z.object({
	drillType: z.string(),
	resumeFromIndex: z.number().int().min(0),
	completedCount: z.number().int().min(0),
	partialResults: z.record(z.string(), z.unknown()).default({}),
});

function parseParams(params: Params): { weekStartDate: Date; index: number } {
	const weekStartDate = new Date(params.weekStartDate);
	if (isNaN(weekStartDate.getTime())) {
		throw new ValidationError('weekStartDate must be a valid date');
	}
	const index = parseInt(params.index, 10);
	if (!Number.isInteger(index) || index < 0) {
		throw new ValidationError('index must be a non-negative integer');
	}
	return { weekStartDate, index };
}

async function getHandler(
	_req: NextRequest,
	context: AuthContext,
	params: Params,
) {
	await connectToDatabase();
	const { weekStartDate, index } = parseParams(params);

	const challenge = await WeeklyChallengeModel.findOne({
		learnerId: context.userId,
		weekStartDate,
	})
		.lean()
		.exec();

	if (!challenge) {
		throw new NotFoundError('Weekly challenge');
	}

	const checkpoint = (challenge.checkpoints as Record<string, unknown> | undefined)?.[String(index)] ?? null;
	return apiResponse.success({ checkpoint });
}

async function postHandler(
	req: NextRequest,
	context: AuthContext,
	params: Params,
) {
	await connectToDatabase();
	const { weekStartDate, index } = parseParams(params);

	const body = await req.json();
	const parsed = postBodySchema.safeParse(body);
	if (!parsed.success) {
		throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request body');
	}

	const updated = await WeeklyChallengeModel.findOneAndUpdate(
		{ learnerId: context.userId, weekStartDate },
		{ $set: { [`checkpoints.${index}`]: { ...parsed.data, savedAt: new Date() } } },
		{ new: true },
	)
		.lean()
		.exec();

	if (!updated) {
		throw new NotFoundError('Weekly challenge');
	}

	return apiResponse.success({ saved: true });
}

async function deleteHandler(
	_req: NextRequest,
	context: AuthContext,
	params: Params,
) {
	await connectToDatabase();
	const { weekStartDate, index } = parseParams(params);

	const updated = await WeeklyChallengeModel.findOneAndUpdate(
		{ learnerId: context.userId, weekStartDate },
		{ $unset: { [`checkpoints.${index}`]: '' } },
		{ new: true },
	)
		.lean()
		.exec();

	if (!updated) {
		throw new NotFoundError('Weekly challenge');
	}

	return apiResponse.success({ cleared: true });
}

// ─── Next.js route exports ───────────────────────────────────────────────────

export async function GET(
	req: NextRequest,
	segment: { params: Promise<Params> },
) {
	const params = await segment.params;
	return withRole(
		['user'],
		withErrorHandler((r, c) => getHandler(r, c, params)),
	)(req);
}

export async function POST(
	req: NextRequest,
	segment: { params: Promise<Params> },
) {
	const params = await segment.params;
	return withRole(
		['user'],
		withErrorHandler((r, c) => postHandler(r, c, params)),
	)(req);
}

export async function DELETE(
	req: NextRequest,
	segment: { params: Promise<Params> },
) {
	const params = await segment.params;
	return withRole(
		['user'],
		withErrorHandler((r, c) => deleteHandler(r, c, params)),
	)(req);
}
