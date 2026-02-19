// POST /api/v1/ai/listening/analyze
// Analyze listening comprehension using Gemini Native Audio
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { analyzeListeningComprehension } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const formData = await req.formData();
		const audioFile = formData.get('audio') as File;
		const questions = JSON.parse(
			(formData.get('questions') as string) || '[]'
		);

		if (!audioFile) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Audio file is required',
				},
				{ status: 400 }
			);
		}

		if (!Array.isArray(questions) || questions.length === 0) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Questions array is required',
				},
				{ status: 400 }
			);
		}

		// Convert file to buffer
		const arrayBuffer = await audioFile.arrayBuffer();
		const audioBuffer = Buffer.from(arrayBuffer);

		const result = await analyzeListeningComprehension(audioBuffer, questions);

		return NextResponse.json({
			code: 'Success',
			message: 'Listening comprehension analyzed successfully',
			data: result,
		});
	} catch (error: any) {
		logger.error('Error analyzing listening comprehension:', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to analyze listening comprehension',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);

