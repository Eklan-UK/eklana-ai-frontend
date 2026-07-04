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

async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const filter: Record<string, string> = {};

		const drillType = searchParams.get('drillType');
		const topic = searchParams.get('topic');
		const part = searchParams.get('part');

		if (drillType) filter.drillType = drillType;
		if (topic) filter.topic = topic;
		if (part) filter.part = part;

		const templates = await PromptTemplate.find(filter).sort({ drillType: 1, topic: 1, part: 1 }).lean();

		return NextResponse.json({ code: 'Success', data: templates }, { status: 200 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Internal Server Error';
		logger.error('Error fetching prompt templates', { error: message });
		return NextResponse.json({ code: 'ServerError', message }, { status: 500 });
	}
}

async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const { drillType, topic, part, template } = body;

		const missing = ['drillType', 'topic', 'part', 'template'].filter(
			(k) => !body[k] || body[k].trim?.() === '',
		);
		if (missing.length > 0) {
			return NextResponse.json(
				{ code: 'ValidationError', message: `Missing required fields: ${missing.join(', ')}` },
				{ status: 400 },
			);
		}

		if (!VALID_DRILL_TYPES.includes(drillType)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: `drillType must be one of: ${VALID_DRILL_TYPES.join(', ')}`,
				},
				{ status: 400 },
			);
		}

		const existing = await PromptTemplate.findOne({ drillType, topic, part }).lean();
		if (existing) {
			return NextResponse.json(
				{
					code: 'ConflictError',
					message: `A template for drillType "${drillType}", topic "${topic}", part "${part}" already exists`,
				},
				{ status: 409 },
			);
		}

		const doc = await PromptTemplate.create({ drillType, topic, part, template });

		logger.info('Prompt template created', {
			byUserId: context.userId.toString(),
			templateId: doc._id.toString(),
			drillType,
		});

		return NextResponse.json({ code: 'Success', data: doc }, { status: 201 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Internal Server Error';
		logger.error('Error creating prompt template', { error: message });
		return NextResponse.json({ code: 'ServerError', message }, { status: 500 });
	}
}

export const GET = withRole(['admin', 'tutor'], getHandler);
export const POST = withRole(['admin'], postHandler);
