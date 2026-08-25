// POST /api/v1/admin/simulation/scenarios — create a scenario. The slide deck
// upload is optional: background/patientInformation/scenarioScript/hints are
// submitted directly as form fields (whether the tutor edited a slide-deck
// extraction preview or typed them by hand) and are always the source of
// truth for what gets saved. If a file IS attached, it's still parsed and
// re-extracted so rawSourceText/hiddenContext get archived, but that
// extraction's own background/patientInformation/scenarioScript/hints are
// discarded.
// GET  /api/v1/admin/simulation/scenarios — list active scenarios (summary fields only)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import SimulationScenario from '@/models/simulation-scenario';
import SimulationSession from '@/models/simulation-session';
import { simulationScenarioBodySchema } from '@/lib/simulation-scenario-api-schema';
import { extractScenarioContext } from '@/domain/simulation/simulation-scenario-extraction.service';
import { getCompetencyNamesForTopic } from '@/config/competency-framework';
import { loadOfficeParser } from '@/services/document-parser.service';
import { generateGeminiTTSAudio } from '@/services/gemini.service';
import { Types } from 'mongoose';
import { assertStaffCanActOnLearners } from '@/lib/api/staff-learner-access';

async function handler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const formData = await req.formData();
		const file = formData.get('file');

		// Slide deck is optional — extraction is a pre-fill aid, not a requirement.
		let fileToProcess: File | Blob | null = null;
		let fileSize = 0;

		if (file) {
			if (typeof file === 'string') {
				return NextResponse.json(
					{ code: 'ValidationError', message: 'Invalid file format. Expected File object.' },
					{ status: 400 }
				);
			}

			if (file instanceof File) {
				fileToProcess = file;
				fileSize = file.size;
			} else {
				// If it's not a File and not a string, it might be a Blob-like object
				const blobLike = file as any;
				if (
					blobLike &&
					typeof blobLike.size === 'number' &&
					typeof blobLike.arrayBuffer === 'function'
				) {
					fileToProcess = blobLike as Blob;
					fileSize = blobLike.size;
				} else {
					return NextResponse.json(
						{ code: 'ValidationError', message: 'Invalid file format. Expected File or Blob.' },
						{ status: 400 }
					);
				}
			}

			// Check file size (max 10MB)
			const maxSize = 10 * 1024 * 1024;
			if (fileSize > maxSize) {
				return NextResponse.json(
					{ code: 'ValidationError', message: 'File size exceeds 10MB limit' },
					{ status: 400 }
				);
			}
		}

		// FormData entries are all strings, so assignedLearnerIds is collected
		// into a plain object shape before Zod coerces/validates the rest.
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

		await connectToDatabase();

		const access = await assertStaffCanActOnLearners(ctx, validated.assignedLearnerIds);
		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Learner not found or access denied' },
				{ status: 404 },
			);
		}

		let rawText: string | undefined;
		let hiddenContext: string | undefined;

		if (fileToProcess) {
			let parsedText: string;
			try {
				const officeParserModule = await loadOfficeParser();
				const arrayBuffer = await fileToProcess.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);
				const ast = await officeParserModule.parseOffice(buffer);
				parsedText = ast.toText();
			} catch (error: any) {
				logger.error('[SimulationScenarios] Failed to parse slide deck', {
					error: error.message,
					stack: error.stack,
					name: error.name,
				});

				let errorMessage = 'Failed to parse document';
				if (error.message?.includes('officeparser')) {
					errorMessage = 'Document parsing library error. Please ensure all required packages are installed.';
				} else if (error.message) {
					errorMessage = error.message;
				}

				return NextResponse.json(
					{ code: 'ServerError', message: errorMessage },
					{ status: 500 }
				);
			}

			rawText = parsedText;

			// Archival only (rawSourceText/hiddenContext) — this extraction's
			// background/patientInformation/scenarioScript/hints are intentionally
			// discarded.
			const extraction = await extractScenarioContext(parsedText, validated.studentCharacterName);
			hiddenContext = extraction.hiddenContext;
		}

		const [backgroundAudioBuffer, patientInformationAudioBuffer] = await Promise.all([
			generateGeminiTTSAudio(validated.background),
			generateGeminiTTSAudio(validated.patientInformation),
		]);
		const backgroundAudioBase64 = backgroundAudioBuffer.toString('base64');
		const patientInformationAudioBase64 = patientInformationAudioBuffer.toString('base64');

		const scenario = await SimulationScenario.create({
			workplaceSetting: validated.workplaceSetting,
			dramatisationPrompt: validated.dramatisationPrompt,
			studentCharacterName: validated.studentCharacterName,
			topicId: validated.topicId,
			weeklyFocus,
			assignedLearnerIds: validated.assignedLearnerIds,
			background: validated.background,
			backgroundAudioBase64,
			patientInformation: validated.patientInformation,
			patientInformationAudioBase64,
			hiddenContext,
			scenarioScript: validated.scenarioScript,
			hints: validated.hints,
			rawSourceText: rawText,
			gradingRubric: validated.gradingRubric,
			maxDurationMinutes: validated.maxDurationMinutes,
			isActive: true,
			createdBy: ctx.userId,
		});

		return NextResponse.json(
			{ code: 'Success', data: scenario.toObject() },
			{ status: 201 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstIssue = error.issues?.[0];
			return NextResponse.json(
				{ code: 'ValidationError', message: firstIssue?.message ?? 'Invalid input' },
				{ status: 400 }
			);
		}
		logger.error('[SimulationScenarios] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to create scenario' },
			{ status: 500 }
		);
	}
}

// List view: only summary fields, never scenarioScript / hiddenContext /
// rawSourceText / gradingRubric / background / patientInformation / audio —
// those belong to the single-scenario detail view, not this list.
// Topic is the sole scenario identifier now that title has been removed —
// multiple scenarios may share the same topic with nothing else
// distinguishing them here. Known tradeoff, not addressed by this change.
async function listHandler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const scenarios = await SimulationScenario.find({ isActive: true })
			.select('workplaceSetting studentCharacterName topicId weeklyFocus maxDurationMinutes assignedLearnerIds createdAt')
			.populate('assignedLearnerIds', 'firstName lastName email')
			.sort({ createdAt: -1 })
			.lean()
			.exec();

		// Single aggregate query for all scenario IDs that have at least one
		// session, instead of an exists() check per scenario in the list.
		// Uses $group instead of distinct() — distinct isn't supported under
		// Stable API v1 strict mode.
		const scenariosWithSessions = await SimulationSession.aggregate([
			{ $match: { scenarioId: { $in: scenarios.map((scenario: any) => scenario._id) } } },
			{ $group: { _id: '$scenarioId' } },
		]);
		const scenariosWithSessionsSet = new Set(scenariosWithSessions.map((r: any) => String(r._id)));

		const data = scenarios.map((scenario: any) => ({
			_id: scenario._id,
			workplaceSetting: scenario.workplaceSetting,
			studentCharacterName: scenario.studentCharacterName,
			topicId: scenario.topicId,
			weeklyFocus: scenario.weeklyFocus,
			maxDurationMinutes: scenario.maxDurationMinutes,
			assignedLearners: Array.isArray(scenario.assignedLearnerIds)
				? scenario.assignedLearnerIds.map((learner: any) => ({
						_id: learner._id,
						name:
							`${learner.firstName ?? ''} ${learner.lastName ?? ''}`.trim() ||
							learner.email ||
							'Unknown',
					}))
				: [],
			hasSessions: scenariosWithSessionsSet.has(String(scenario._id)),
			createdAt: scenario.createdAt,
		}));

		return NextResponse.json({ code: 'Success', data }, { status: 200 });
	} catch (error: any) {
		logger.error('[SimulationScenarios] GET error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to fetch scenarios' },
			{ status: 500 }
		);
	}
}

export const POST = withRole(['tutor', 'admin'], handler);
export const GET = withRole(['tutor', 'admin'], listHandler);
