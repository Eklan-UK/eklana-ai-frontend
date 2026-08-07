// POST /api/v1/precision-clinic/[id]/archive
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import {
	PrecisionClinicRepository,
	PrecisionClinicService,
} from '@/domain/precision-clinic';

async function handler(
	_req: NextRequest,
	_context: { userId: string; userRole: string },
	params: { id: string }
) {
	await connectToDatabase();
	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);
	const drill = await service.archive(params.id);
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
