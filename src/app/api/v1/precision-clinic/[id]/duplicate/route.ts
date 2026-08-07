// POST /api/v1/precision-clinic/[id]/duplicate
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import User from '@/models/user';
import {
	PrecisionClinicRepository,
	PrecisionClinicService,
} from '@/domain/precision-clinic';

async function handler(
	_req: NextRequest,
	context: { userId: string; userRole: string },
	params: { id: string }
) {
	await connectToDatabase();

	const creator = await User.findById(context.userId)
		.select('email')
		.lean()
		.exec();

	const repo = new PrecisionClinicRepository();
	const service = new PrecisionClinicService(repo);
	const drill = await service.duplicate(params.id, {
		userId: context.userId.toString(),
		email: (creator as { email?: string } | null)?.email,
	});

	return apiResponse.success({ drill }, 201);
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
