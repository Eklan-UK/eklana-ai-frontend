import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import StudentContext from '@/models/studentContext';
import {
	assertStaffCanReadLearner,
	resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { studentId: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { studentId } = params;

		if (!studentId || !Types.ObjectId.isValid(studentId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid student ID' },
				{ status: 400 },
			);
		}

		const canonicalLearnerId = await resolveLearnerIdToUserIdString(studentId);
		const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Student not found' },
				{ status: 404 },
			);
		}

		const doc = await StudentContext.findOne({ studentId: canonicalLearnerId });

		if (!doc) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Student context not found' },
				{ status: 404 },
			);
		}

		return NextResponse.json({ code: 'Success', data: doc }, { status: 200 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Internal Server Error';
		logger.error('Error fetching student context', { error: message });
		return NextResponse.json({ code: 'ServerError', message }, { status: 500 });
	}
}

async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { studentId: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { studentId } = params;

		if (!studentId || !Types.ObjectId.isValid(studentId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid student ID' },
				{ status: 400 },
			);
		}

		const canonicalLearnerId = await resolveLearnerIdToUserIdString(studentId);
		const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Student not found' },
				{ status: 404 },
			);
		}

		const body = await req.json();
		const {
			nativeLanguage,
			professionalRole,
			hospitalUnit,
			country,
			proficiencyLevel,
			goals,
			simulationWeaknesses,
		} = body;

		const requiredFields: Record<string, unknown> = {
			nativeLanguage,
			professionalRole,
			hospitalUnit,
			country,
			proficiencyLevel,
			goals,
		};

		const missing = Object.entries(requiredFields)
			.filter(([, v]) => v === undefined || v === null || v === '')
			.map(([k]) => k);

		if (missing.length > 0) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: `Missing required fields: ${missing.join(', ')}`,
				},
				{ status: 400 },
			);
		}

		const validLevels = ['beginner', 'intermediate', 'advanced'];
		if (!validLevels.includes(proficiencyLevel)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: `proficiencyLevel must be one of: ${validLevels.join(', ')}`,
				},
				{ status: 400 },
			);
		}

		const update: Record<string, unknown> = {
			nativeLanguage,
			professionalRole,
			hospitalUnit,
			country,
			proficiencyLevel,
			goals,
		};

		if (simulationWeaknesses !== undefined) {
			update.simulationWeaknesses = simulationWeaknesses;
		}

		const doc = await StudentContext.findOneAndUpdate(
			{ studentId: canonicalLearnerId },
			{ $set: update },
			{ upsert: true, new: true, runValidators: true },
		);

		logger.info('Student context upserted', {
			byUserId: context.userId.toString(),
			studentId: canonicalLearnerId,
		});

		return NextResponse.json({ code: 'Success', data: doc }, { status: 200 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Internal Server Error';
		logger.error('Error upserting student context', { error: message });
		return NextResponse.json({ code: 'ServerError', message }, { status: 500 });
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ studentId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], (req, context) =>
		getHandler(req, context, resolvedParams),
	)(req);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ studentId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['admin', 'tutor'], (req, context) =>
		postHandler(req, context, resolvedParams),
	)(req);
}
