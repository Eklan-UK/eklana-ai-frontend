// GET /api/v1/pronunciations - Get all pronunciations (admin)
// POST /api/v1/pronunciations - Create a new pronunciation (admin)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import Pronunciation from '@/models/pronunciation';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';
import { uploadToCloudinary } from '@/services/cloudinary.service';

// GET handler - Get all pronunciations
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { searchParams } = new URL(req.url);
		const limit = parseInt(searchParams.get('limit') || '100');
		const offset = parseInt(searchParams.get('offset') || '0');
		const difficulty = searchParams.get('difficulty');
		const isActive = searchParams.get('isActive');
		const search = searchParams.get('search');

		// Build query
		const query: any = {};

		if (difficulty) {
			query.difficulty = difficulty;
		}

		if (isActive !== undefined) {
			query.isActive = isActive === 'true';
		}

		if (search) {
			query.$or = [
				{ title: { $regex: search, $options: 'i' } },
				{ text: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } },
			];
		}

		// Get pronunciations with pagination
		const pronunciations = await Pronunciation.find(query)
			.populate('createdBy', 'email firstName lastName')
			.sort({ createdAt: -1 })
			.limit(limit)
			.skip(offset)
			.lean()
			.exec();

		const total = await Pronunciation.countDocuments(query);

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciations retrieved successfully',
				data: {
					pronunciations,
					pagination: {
						total,
						limit,
						offset,
						hasMore: offset + pronunciations.length < total,
					},
				},
			},
			{ status: 200 }
		);
	} catch (error: any) {
		logger.error('Error fetching pronunciations', {
			error: error.message,
			stack: error.stack,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to fetch pronunciations',
			},
			{ status: 500 }
		);
	}
}

// POST handler - Create pronunciation
async function postHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		// Parse form data
		const formData = await req.formData();
		const title = formData.get('title') as string;
		const description = formData.get('description') as string | null;
		const text = formData.get('text') as string;
		const phonetic = formData.get('phonetic') as string | null;
		const difficulty = (formData.get('difficulty') as string) || 'intermediate';
		const tags = formData.get('tags') as string | null;
		const audioFile = formData.get('audio') as File | null;

		// Validate required fields
		if (!title || !text) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: 'Title and text are required',
				},
				{ status: 400 }
			);
		}

		// Get creator
		const creator = await User.findById(context.userId).select('email role').lean().exec();
		if (!creator) {
			return NextResponse.json(
				{
					code: 'NotFoundError',
					message: 'User not found',
				},
				{ status: 404 }
			);
		}

		// Only admins can create pronunciations
		if (creator.role !== 'admin') {
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'Only admins can create pronunciations',
				},
				{ status: 403 }
			);
		}

		// Audio file is optional - if not provided, use TTS
		let audioUrl: string | undefined;
		let audioFileName: string | undefined;
		const useTTS = !audioFile; // Use TTS if no audio file uploaded

		// Upload audio to Cloudinary if file is provided
		if (audioFile) {
			const arrayBuffer = await audioFile.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			const uploadResult = await uploadToCloudinary(buffer, {
				folder: 'eklan/pronunciations/audio',
				publicId: `pronunciation_${Date.now()}_${context.userId}`,
				resourceType: 'raw', // Use 'raw' for audio files
			});
			audioUrl = uploadResult.secureUrl;
			audioFileName = audioFile.name;
		}

		// Parse tags if provided as string
		let tagsArray: string[] = [];
		if (tags) {
			tagsArray = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
		}

		// Create pronunciation
		const pronunciation = await Pronunciation.create({
			title,
			description: description || undefined,
			text,
			phonetic: phonetic || undefined,
			difficulty: difficulty || 'intermediate',
			audioUrl: audioUrl,
			audioFileName: audioFileName,
			useTTS: useTTS,
			createdBy: context.userId,
			isActive: true,
			tags: tagsArray,
		});

		await pronunciation.populate('createdBy', 'email firstName lastName');

		logger.info('Pronunciation created successfully', {
			pronunciationId: pronunciation._id,
			createdBy: context.userId,
		});

		return NextResponse.json(
			{
				code: 'Success',
				message: 'Pronunciation created successfully',
				data: {
					pronunciation,
				},
			},
			{ status: 201 }
		);
	} catch (error: any) {
		logger.error('Error creating pronunciation', {
			error: error.message,
			stack: error.stack,
			userId: context.userId,
		});
		return NextResponse.json(
			{
				code: 'ServerError',
				message: error.message || 'Failed to create pronunciation',
			},
			{ status: 500 }
		);
	}
}

export const GET = withRole(['admin'], getHandler);
export const POST = withRole(['admin'], postHandler);

