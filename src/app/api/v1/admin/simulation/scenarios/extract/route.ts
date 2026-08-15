// POST /api/v1/admin/simulation/scenarios/extract — preview/pre-fill only.
// Runs scenario extraction against an uploaded slide deck and returns the raw
// result as JSON. Does NOT create or save anything — the tutor edits the
// result before submitting it via POST /api/v1/admin/simulation/scenarios.
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';
import { simulationScenarioExtractBodySchema } from '@/lib/simulation-scenario-api-schema';
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

		let fileToProcess: File | Blob;
		let fileSize: number;

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

		const maxSize = 10 * 1024 * 1024;
		if (fileSize > maxSize) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'File size exceeds 10MB limit' },
				{ status: 400 }
			);
		}

		const validated = simulationScenarioExtractBodySchema.parse({
			studentCharacterName: formData.get('studentCharacterName'),
		});

		let rawText: string;
		try {
			const officeParserModule = await loadOfficeParser();
			const arrayBuffer = await fileToProcess.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const ast = await officeParserModule.parseOffice(buffer);
			rawText = ast.toText();
		} catch (error: any) {
			logger.error('[SimulationScenarioExtract] Failed to parse slide deck', {
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

		const result = await extractScenarioContext(rawText, validated.studentCharacterName);

		return NextResponse.json(
			{ code: 'Success', data: result },
			{ status: 200 }
		);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstIssue = error.issues?.[0];
			return NextResponse.json(
				{ code: 'ValidationError', message: firstIssue?.message ?? 'Invalid input' },
				{ status: 400 }
			);
		}
		logger.error('[SimulationScenarioExtract] POST error', {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});
		return NextResponse.json(
			{ code: 'ServerError', message: 'Failed to extract scenario content' },
			{ status: 500 }
		);
	}
}

export const POST = withRole(['tutor', 'admin'], handler);
