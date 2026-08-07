// GET/PUT/DELETE /api/v1/precision-clinic/[id]
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
import { updatePrecisionClinicSchema } from '@/domain/precision-clinic/precision-clinic.validation';

async function getHandler(
	_req: NextRequest,
	_context: { userId: string; userRole: string },
	params: { id: string }
) {
	await connectToDatabase();
	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);
	const drill = await service.getById(params.id);
	return apiResponse.success({ drill });
}

async function putHandler(
	req: NextRequest,
	_context: { userId: string; userRole: string },
	params: { id: string }
) {
	await connectToDatabase();
	const body = await parseRequestBody(req);
	const validated = validateRequest(updatePrecisionClinicSchema, body);

	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);
	const drill = await service.update(params.id, validated);
	return apiResponse.success({ drill });
}

async function deleteHandler(
	_req: NextRequest,
	_context: { userId: string; userRole: string },
	params: { id: string }
) {
	await connectToDatabase();
	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);
	await service.delete(params.id);
	return apiResponse.success({ message: 'Precision clinic drill deleted' });
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const resolvedParams = await params;
	return withRole(
		['admin'],
		withErrorHandler((req, context) =>
			getHandler(req, context, resolvedParams)
		)
	)(req);
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const resolvedParams = await params;
	return withRole(
		['admin'],
		withErrorHandler((req, context) =>
			putHandler(req, context, resolvedParams)
		)
	)(req);
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const resolvedParams = await params;
	return withRole(
		['admin'],
		withErrorHandler((req, context) =>
			deleteHandler(req, context, resolvedParams)
		)
	)(req);
}
