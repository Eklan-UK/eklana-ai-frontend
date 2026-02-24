// POST /api/v1/ai/voice/conversation
// Process voice message using Gemini Native Audio
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { processVoiceMessage } from '@/services/gemini.service';
import { logger } from '@/lib/api/logger';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string }
): Promise<NextResponse> {
	try {
		const formData = await req.formData();
		const audioFile = formData.get('audio') as File;
		const conversationHistory = JSON.parse(
			(formData.get('conversationHistory') as string) || '[]'
		);
		const contextPrompt = (formData.get('context') as string) || undefined;

		if (!audioFile) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Audio file is required',
				},
				{ status: 400 }
			);
		}

		// Convert file to buffer
		const arrayBuffer = await audioFile.arrayBuffer();
		const audioBuffer = Buffer.from(arrayBuffer);

		const response = await processVoiceMessage(
			audioBuffer,
			conversationHistory,
			contextPrompt
		);

		return NextResponse.json({
			code: 'Success',
			message: 'Voice message processed successfully',
			data: { response },
		});
	} catch (error: any) {
		logger.error('Error processing voice message:', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message?.includes('429') || error.message?.includes('quota')
					? 'AI service is temporarily busy. Please wait a moment and try again.'
					: 'Failed to process voice message. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);






