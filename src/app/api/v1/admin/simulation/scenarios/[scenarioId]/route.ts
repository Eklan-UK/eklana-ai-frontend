// GET    /api/v1/admin/simulation/scenarios/[scenarioId] — fetch a single
// scenario with its full fields (edit form pre-fill; the list route only
// returns summary fields).
// PATCH  /api/v1/admin/simulation/scenarios/[scenarioId] — edit a scenario's
// fields. Blocked once any student has started a session on it (see the
// SimulationSession.exists() guard below) — a scenario in flight must stay
// stable for every learner already partway through it.
// DELETE /api/v1/admin/simulation/scenarios/[scenarioId] — soft-delete a scenario
// (isActive: false). Matches the isActive pattern already used on this model:
// an explicit status boolean, not a TTL index, so scenarios remain queryable
// for reporting/audit after deletion.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import { Types } from 'mongoose';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession from '@/models/simulation-session';
import { simulationScenarioBodySchema } from '@/lib/simulation-scenario-api-schema';
import { getCompetencyNamesForTopic } from '@/config/competency-framework';
import { generateGeminiTTSAudio } from '@/services/gemini.service';
import { resolveTutorScopedLearnerIds } from '@/lib/api/staff-learner-access';

async function getHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { scenarioId: string },
): Promise<NextResponse> {
	try {
		const { scenarioId } = params;

		if (!scenarioId || !Types.ObjectId.isValid(scenarioId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid scenario ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		const scenario = await SimulationScenario.findOne({ _id: scenarioId, isActive: true })
			.populate('assignedLearnerIds', 'firstName lastName email')
			.lean();

		if (!scenario) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 },
			);
		}

		const hasSessions = await SimulationSession.exists({ scenarioId });

		return NextResponse.json(
			{ code: 'Success', data: { ...scenario, hasSessions: Boolean(hasSessions) } },
			{ status: 200 },
		);
	} catch (error: any) {
		logger.error('[SimulationScenarioDetail] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to fetch scenario' },
			{ status: 500 },
		);
	}
}

async function patchHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { scenarioId: string },
): Promise<NextResponse> {
	try {
		const { scenarioId } = params;

		if (!scenarioId || !Types.ObjectId.isValid(scenarioId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid scenario ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		const scenario = await SimulationScenario.findOne({ _id: scenarioId, isActive: true });

		if (!scenario) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 },
			);
		}

		// Existence check only — status (in_progress/completed/abandoned) doesn't
		// matter, a session document existing at all means a student has already
		// started on this scenario.
		const hasSessions = await SimulationSession.exists({ scenarioId });

		if (hasSessions) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'This scenario cannot be edited because students have already started sessions on it.',
				},
				{ status: 400 },
			);
		}

		const formData = await req.formData();

		const rawAssignedLearnerIds = formData.getAll('assignedLearnerIds').map(String);
		const fields: Record<string, unknown> = {
			workplaceSetting: formData.get('workplaceSetting'),
			dramatisationPrompt: formData.get('dramatisationPrompt'),
			studentCharacterName: formData.get('studentCharacterName'),
			topicId: formData.get('topicId'),
			gradingRubric: formData.get('gradingRubric'),
			maxDurationMinutes: formData.get('maxDurationMinutes'),
			assignedLearnerIds: rawAssignedLearnerIds,
			background: formData.get('background'),
			patientInformation: formData.get('patientInformation'),
			scenarioScript: formData.get('scenarioScript'),
			hints: formData.get('hints') ?? undefined,
		};

		const validated = simulationScenarioBodySchema.parse(fields);
		const weeklyFocus = getCompetencyNamesForTopic(validated.topicId);

		let assignedLearnerIds = validated.assignedLearnerIds;
		if (ctx.userRole === 'tutor') {
			const scoped = await resolveTutorScopedLearnerIds(ctx);
			if (!scoped.ok) {
				return NextResponse.json(
					{ code: 'NotFound', message: 'Learner not found or access denied' },
					{ status: 404 },
				);
			}
			const roster = new Set(scoped.learnerIds ?? []);
			const incoming = validated.assignedLearnerIds.map(String);
			const existing: string[] = (scenario.assignedLearnerIds ?? []).map(
				(id: Types.ObjectId | string) => String(id),
			);
			const existingSet = new Set(existing);
			if (incoming.some((id) => !roster.has(id) && !existingSet.has(id))) {
				return NextResponse.json(
					{ code: 'NotFound', message: 'Learner not found or access denied' },
					{ status: 404 },
				);
			}
			const preserved = existing.filter((id) => !roster.has(id));
			const incomingOnRoster = incoming.filter((id) => roster.has(id));
			assignedLearnerIds = [...new Set([...preserved, ...incomingOnRoster])];
		}

		// Only re-synthesize each audio track when its spoken text actually
		// changed — TTS generation is the expensive part of this update.
		const [backgroundAudioBase64, patientInformationAudioBase64] = await Promise.all([
			validated.background !== scenario.background
				? generateGeminiTTSAudio(validated.background).then((buf) => buf.toString('base64'))
				: Promise.resolve(scenario.backgroundAudioBase64),
			validated.patientInformation !== scenario.patientInformation
				? generateGeminiTTSAudio(validated.patientInformation).then((buf) => buf.toString('base64'))
				: Promise.resolve(scenario.patientInformationAudioBase64),
		]);

		const updated = await SimulationScenario.findOneAndUpdate(
			{ _id: scenarioId, isActive: true },
			{
				$set: {
					workplaceSetting: validated.workplaceSetting,
					dramatisationPrompt: validated.dramatisationPrompt,
					studentCharacterName: validated.studentCharacterName,
					topicId: validated.topicId,
					weeklyFocus,
					assignedLearnerIds,
					background: validated.background,
					backgroundAudioBase64,
					patientInformation: validated.patientInformation,
					patientInformationAudioBase64,
					scenarioScript: validated.scenarioScript,
					hints: validated.hints,
					gradingRubric: validated.gradingRubric,
					maxDurationMinutes: validated.maxDurationMinutes,
				},
			},
			{ new: true },
		);

		return NextResponse.json({ code: 'Success', data: updated?.toObject() }, { status: 200 });
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstIssue = error.issues?.[0];
			return NextResponse.json(
				{ code: 'ValidationError', message: firstIssue?.message ?? 'Invalid input' },
				{ status: 400 },
			);
		}
		logger.error('[SimulationScenarioDetail] PATCH error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to update scenario' },
			{ status: 500 },
		);
	}
}

async function deleteHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string },
	params: { scenarioId: string },
): Promise<NextResponse> {
	try {
		const { scenarioId } = params;

		if (!scenarioId || !Types.ObjectId.isValid(scenarioId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid scenario ID' },
				{ status: 400 },
			);
		}

		await connectToDatabase();

		// Targeted update instead of load-mutate-save: a full save() re-validates
		// the entire document, which 500s on older scenarios created before the
		// current required fields (background/patientInformation/audio/etc.)
		// existed, even though this delete doesn't touch any of them.
		const scenario = await SimulationScenario.findOneAndUpdate(
			{ _id: scenarioId, isActive: true },
			{ isActive: false },
			{ new: true },
		);

		if (!scenario) {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Scenario not found' },
				{ status: 404 },
			);
		}

		return NextResponse.json({ code: 'Success', data: null }, { status: 200 });
	} catch (error: any) {
		logger.error('[SimulationScenarioDetail] DELETE error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to delete scenario' },
			{ status: 500 },
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ scenarioId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		getHandler(req, context, resolvedParams),
	)(req);
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ scenarioId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		patchHandler(req, context, resolvedParams),
	)(req);
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ scenarioId: string }> },
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		deleteHandler(req, context, resolvedParams),
	)(req);
}
