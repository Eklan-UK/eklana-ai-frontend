// POST /api/v1/ai/pronunciation/analyze
// Analyze pronunciation using Gemini Native Audio
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { analyzePronunciationAudio } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const formData = await req.formData();
		const audioFile = formData.get('audio') as File;
		const expectedText = formData.get('expectedText') as string;
		const language = (formData.get('language') as string) || 'en-US';

		if (!audioFile) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Audio file is required',
				},
				{ status: 400 }
			);
		}

		if (!expectedText) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Expected text is required',
				},
				{ status: 400 }
			);
		}

		// Convert file to buffer
		const arrayBuffer = await audioFile.arrayBuffer();
		const audioBuffer = Buffer.from(arrayBuffer);

		const result = await analyzePronunciationAudio(audioBuffer, expectedText, {
			language,
			provideFeedback: true,
		});

		return NextResponse.json({
			code: 'Success',
			message: 'Pronunciation analyzed successfully',
			data: result,
		});
	} catch (error: any) {
		logger.error('Error analyzing pronunciation:', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message?.includes('429') || error.message?.includes('quota')
					? 'AI service is temporarily busy. Please wait a moment and try again.'
					: 'Failed to analyze pronunciation. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);





