// POST /api/v1/admin/simulation/scenarios — create a scenario from an uploaded slide deck
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import SimulationScenario from '@/models/simulation-scenario';
import { simulationScenarioBodySchema } from '@/lib/simulation-scenario-api-schema';
import { extractScenarioContext } from '@/domain/simulation/simulation-scenario-extraction.service';
import { loadOfficeParser } from '@/services/document-parser.service';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	ctx: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		const formData = await req.formData();
		const file = formData.get('file');

		if (!file) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'No file provided' },
				{ status: 400 }
			);
		}

		// Convert FormData file to File/Blob
		// In Next.js, formData.get() returns FormDataEntryValue which is File | string
		let fileToProcess: File | Blob;
		let fileName: string;
		let fileSize: number;

		if (typeof file === 'string') {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid file format. Expected File object.' },
				{ status: 400 }
			);
		}

		if (file instanceof File) {
			fileToProcess = file;
			fileName = file.name || 'document';
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
				fileName = blobLike.name || 'document';
				fileSize = blobLike.size;
			} else {
				return NextResponse.json(
					{ code: 'ValidationError', message: 'Invalid file format. Expected File or Blob.' },
					{ status: 400 }
				);
			}
		}

		if (!fileName) {
			fileName = 'document';
		}

		// Check file size (max 10MB)
		const maxSize = 10 * 1024 * 1024;
		if (fileSize > maxSize) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'File size exceeds 10MB limit' },
				{ status: 400 }
			);
		}

		// FormData entries are all strings, so assignedLearnerIds is collected
		// into a plain object shape before Zod coerces/validates the rest.
		const rawAssignedLearnerIds = formData.getAll('assignedLearnerIds').map(String);
		const fields: Record<string, unknown> = {
			title: formData.get('title'),
			workplaceSetting: formData.get('workplaceSetting'),
			dramatisationPrompt: formData.get('dramatisationPrompt'),
			weeklyFocus: formData.get('weeklyFocus'),
			gradingRubric: formData.get('gradingRubric'),
			maxDurationMinutes: formData.get('maxDurationMinutes'),
			assignedLearnerIds: rawAssignedLearnerIds,
		};

		const validated = simulationScenarioBodySchema.parse(fields);

		let rawText: string;
		try {
			const officeParserModule = await loadOfficeParser();
			const arrayBuffer = await fileToProcess.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const ast = await officeParserModule.parseOffice(buffer);
			rawText = ast.toText();
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

		const { displayData, hiddenContext } = await extractScenarioContext(rawText);

		await connectToDatabase();

		const scenario = await SimulationScenario.create({
			title: validated.title,
			workplaceSetting: validated.workplaceSetting,
			dramatisationPrompt: validated.dramatisationPrompt,
			weeklyFocus: validated.weeklyFocus,
			assignedLearnerIds: validated.assignedLearnerIds,
			displayData,
			hiddenContext,
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

export const POST = withRole(['tutor', 'admin'], handler);
