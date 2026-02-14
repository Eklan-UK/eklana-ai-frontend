// GET /api/v1/pronunciation-problems/[slug]/words - Get words in a problem
// POST /api/v1/pronunciation-problems/[slug]/words - Add word to problem (admin)
import { NextRequest, NextResponse } from 'next/server';
import { withRole, withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
// Import User FIRST to ensure it's registered before PronunciationWord references it
import User from '@/models/user';
import PronunciationProblem from '@/models/pronunciation-problem';
import PronunciationWord from '@/models/pronunciation-word';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { uploadToCloudinary } from '@/services/cloudinary.service';

// GET handler - Get words in a problem
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { slug: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { slug } = params;

		// Find problem by slug
		const problem = await PronunciationProblem.findOne({ slug, isActive: true }).lean().exec();
		if (!problem) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation problem not found',
				},
				{ status: 404 }
			);
		}

		// Get words (only active for learners, all for admin)
		const query: any = { problemId: problem._id };
		if (context.userRole !== 'admin') {
			query.isActive = true;
		}

		const words = await PronunciationWord.find(query)
			.populate('createdBy', 'email firstName lastName')
			.sort({ order: 1 })
			.lean()
			.exec();

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Words retrieved successfully',
				data: {
					words,
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching words', {
			error: error.message,
			stack: error.stack,
			slug: params.slug,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch words',
			},
			{ status: 500 }
		);
	}
}

// POST handler - Add word to problem (admin only)
async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { slug: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { slug } = params;

		// Find problem by slug
		const problem = await PronunciationProblem.findOne({ slug, isActive: true }).lean().exec();
		if (!problem) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'Pronunciation problem not found',
				},
				{ status: 404 }
			);
		}

		// Parse form data
		const formData = await req.formData();
		const word = formData.get('word') as string;
		const ipa = formData.get('ipa') as string;
		const phonemes = (formData.get('phonemes') as string)?.split(',').map(p => p.trim()).filter(Boolean) || [];
		// Type is inherited from problem, not from form data
		const type = problem.type || 'word'; // Use problem's type, fallback to 'word'
		const difficulty = (formData.get('difficulty') as string) || 'intermediate';
		const order = parseInt(formData.get('order') as string) || 0;
		const audioFile = formData.get('audio') as File | null;

		// Validate required fields
		if (!word || !ipa || !phonemes || phonemes.length === 0) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Word, IPA, and at least one phoneme are required',
				},
				{ status: 400 }
			);
		}

		// Validate that problem has a type
		if (!problem.type) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Pronunciation problem must have a type set before adding words',
				},
				{ status: 400 }
			);
		}

		// Audio file is optional
		let audioUrl: string | undefined;
		let audioFileName: string | undefined;
		const useTTS = !audioFile;

		if (audioFile) {
			const arrayBuffer = await audioFile.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			const uploadResult = await uploadToCloudinary(buffer, {
				folder: 'eklan/pronunciations/words',
				publicId: `word_${Date.now()}_${context.userId}`,
				resourceType: 'raw',
			});
			audioUrl = uploadResult.secureUrl;
			audioFileName = audioFile.name;
		}

		// Create word
		const pronunciationWord = await PronunciationWord.create({
			word,
			ipa,
			phonemes,
			problemId: problem._id,
			type: type,
			difficulty: difficulty || 'intermediate',
			audioUrl: audioUrl,
			audioFileName: audioFileName,
			useTTS: useTTS,
			order: order,
			createdBy: context.userId,
			isActive: true,
		});

		await pronunciationWord.populate('createdBy', 'email firstName lastName');

		logger.info('Pronunciation word created successfully', {
			wordId: pronunciationWord._id,
			problemId: problem._id,
			createdBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation word created successfully',
				data: {
					word: pronunciationWord,
				},
			},
			{ status: 201 }
		);
	} catch (error: any) {
		logger.error('Error creating pronunciation word', {
			error: error.message,
			stack: error.stack,
			slug: params.slug,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to create pronunciation word',
			},
			{ status: 500 }
		);
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ slug: string }> }
) {
	const resolvedParams = await params;
	return withAuth((req, context) =>
		getHandler(req, context, resolvedParams)
	)(req);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ slug: string }> }
) {
	const resolvedParams = await params;
	return withRole(['admin'], (req, context) =>
		postHandler(req, context, resolvedParams)
	)(req);
}

