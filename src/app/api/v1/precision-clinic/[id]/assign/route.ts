// POST /api/v1/precision-clinic/[id]/assign
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import {
	PrecisionClinicRepository,
	PrecisionClinicService,
} from '@/domain/precision-clinic';
import { assignPrecisionClinicSchema } from '@/domain/precision-clinic/precision-clinic.validation';

async function handler(
	req: NextRequest,
	_context: { userId: string; userRole: string },
	params: { id: string }
) {
	await connectToDatabase();
	const body = await parseRequestBody(req);
	const validated = validateRequest(assignPrecisionClinicSchema, body);

	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);
	const drill = await service.assign(params.id, validated.userIds);

	return apiResponse.success({ drill });
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const resolvedParams = await params;
	return withRole(
		['admin'],
		withErrorHandler((req, context) =>
			handler(req, context, resolvedParams)
		)
	)(req);
}
