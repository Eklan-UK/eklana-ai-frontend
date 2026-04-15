// POST /api/v1/speechace/score
// Score pronunciation using Speechace API
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // Allow up to 5 min for Speechace to process long audio
import { withAuth } from '@/lib/api/middleware';
import { speechaceService } from '@/lib/api/speechace.service';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	// #region agent log
	const _stagingKeyPresent = !!(process.env.SPEECHACE_API_KEY);
	const _stagingKeyPrefix = process.env.SPEECHACE_API_KEY ? process.env.SPEECHACE_API_KEY.substring(0, 6) : 'MISSING';
	console.log(`[speechace/score] >>> ROUTE HIT at ${new Date().toISOString()} | key_present=${_stagingKeyPresent} | key_prefix=${_stagingKeyPrefix} | content-length=${req.headers.get('content-length')}`);
	fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3e4a0a'},body:JSON.stringify({sessionId:'3e4a0a',location:'score/route.ts:entry',message:'route handler hit',data:{keyPresent:_stagingKeyPresent,keyPrefix:_stagingKeyPrefix,contentLength:req.headers.get('content-length')},timestamp:Date.now(),hypothesisId:'H-A,H-B,H-C'})}).catch(()=>{});
	// #endregion
	try {
		const body = await req.json();
		const { text, audioBase64, questionInfo } = body;

		// Validation
		if (!text || typeof text !== 'string') {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Text is required and must be a string',
				},
				{ status: 400 }
			);
		}

		if (!audioBase64 || typeof audioBase64 !== 'string') {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Audio data (base64) is required',
				},
				{ status: 400 }
			);
		}

		// Validate text length
		if (text.length > 1500) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Text must be less than 1500 characters',
				},
				{ status: 400 }
			);
		}

		// Validate base64 format
		const base64Regex = /^data:audio\/[^;]+;base64,/;
		let cleanAudioBase64 = audioBase64;

		// Remove data URL prefix if present
		if (base64Regex.test(audioBase64)) {
			cleanAudioBase64 = audioBase64.split(',')[1];
		}

		// #region agent log
		const _base64Bytes = cleanAudioBase64.length;
		const _bufferBytes = Math.floor(_base64Bytes * 0.75);
		console.log(`[speechace/score] >>> PAYLOAD: base64Len=${_base64Bytes} estimatedBufferBytes=${_bufferBytes} textLen=${text.length}`);
		fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3e4a0a'},body:JSON.stringify({sessionId:'3e4a0a',location:'score/route.ts:pre-call',message:'payload details before Speechace call',data:{base64Len:_base64Bytes,estimatedBufferBytes:_bufferBytes,textLen:text.length},timestamp:Date.now(),hypothesisId:'H-B,H-D'})}).catch(()=>{});
		// #endregion
		// Call Speechace service
		const result = await speechaceService.scorePronunciation(
			text,
			cleanAudioBase64,
			context.userId.toString(),
			questionInfo
		);

		logger.info('Pronunciation scored successfully', {
			userId: context.userId.toString(),
			text,
			score: result.text_score,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation scored successfully',
				data: result,
			},
			{ status: 200 }
		);
	} catch (error: any) {
		// #region agent log
		console.error(`[speechace/score] >>> ERROR: ${error.message}`, error.stack);
		fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3e4a0a'},body:JSON.stringify({sessionId:'3e4a0a',location:'score/route.ts:catch',message:'handler caught error',data:{errorMessage:error.message,errorName:error.name},timestamp:Date.now(),hypothesisId:'H-A,H-C,H-D,H-E'})}).catch(()=>{});
		// #endregion
		logger.error('Error scoring pronunciation', {
			error: error.message,
			stack: error.stack,
		});

		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to score pronunciation',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(handler);


