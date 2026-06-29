import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import PromptTemplate, { type DrillType } from '@/models/promptTemplate';

const VALID_DRILL_TYPES: DrillType[] = [
	'vocabulary',
	'pronunciation',
	'roleplay',
	'matching',
	'definition',
	'grammar',
	'sentence_writing',
	'fill_blank',
	'key_phrases',
	'summary',
];

async function putHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { templateId: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { templateId } = params;

		if (!templateId || !Types.ObjectId.isValid(templateId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid template ID' },
				{ status: 400 },
			);
		}

		const body = await req.json();
		const { drillType, topic, part, template } = body;

		if (drillType !== undefined && !VALID_DRILL_TYPES.includes(drillType)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: `drillType must be one of: ${VALID_DRILL_TYPES.join(', ')}`,
				},
				{ status: 400 },
			);
		}

		const update: Record<string, string> = {};
		if (drillType !== undefined) update.drillType = drillType;
		if (topic !== undefined) update.topic = topic;
		if (part !== undefined) update.part = part;
		if (template !== undefined) update.template = template;

		if (Object.keys(update).length === 0) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'No fields provided to update' },
				{ status: 400 },
			);
		}

		const doc = await PromptTemplate.findByIdAndUpdate(
			templateId,
			{ $set: update },
			{ new: true, runValidators: true },
		).lean();

		if (!doc) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Prompt template not found' },
				{ status: 404 },
			);
		}

		logger.info('Prompt template updated', {
			byUserId: context.userId.toString(),
			templateId,
		});

		return NextResponse.json({ code: 'Success', data: doc }, { status: 200 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Internal Server Error';
		logger.error('Error updating prompt template', { error: message });
		return NextResponse.json({ code: 'ServerError', message }, { status: 500 });
	}
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ templateId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['admin'], (req, context) =>
		putHandler(req, context, resolvedParams),
	)(req);
}
