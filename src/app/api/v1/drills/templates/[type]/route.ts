import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { logger } from '@/lib/api/logger';
import * as XLSX from 'xlsx';

async function handler(
	req: NextRequest,
	context: { userId: any; userRole: string },
	params: { type: string }
): Promise<NextResponse> {
	try {
		// Only tutors and admins can download templates
		if (context.userRole !== 'tutor' && context.userRole !== 'admin') {
			return NextResponse.json(
				{
					code: 'AuthorizationError',
					message: 'Only tutors and admins can download templates',
				},
				{ status: 403 }
			);
		}

		const { type } = params;
		const validTypes = ['vocabulary', 'roleplay', 'matching', 'definition', 'grammar', 'sentence_writing', 'summary'];

		if (!validTypes.includes(type)) {
			return NextResponse.json(
				{
					code: 'ValidationError',
					message: `Invalid drill type. Must be one of: ${validTypes.join(', ')}`,
				},
				{ status: 400 }
			);
		}

		// Generate template based on type
		const template = generateTemplate(type);

		// Create Excel workbook
		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.aoa_to_sheet(template.data);
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

		// Generate buffer
		const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

		// Return as download
		return new NextResponse(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${type}-template.xlsx"`,
			},
		});
	} catch (error: any) {
		logger.error('Error generating template', error);
		return NextResponse.json(
			{
				code: 'ServerError',
				message: 'Failed to generate template',
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

function generateTemplate(type: string): { data: any[][] } {
	switch (type) {
		case 'vocabulary':
			return {
				data: [
					['Word', 'Word Translation', 'Sentence', 'Sentence Translation'],
					['hello', 'hola', 'Hello, how are you?', 'Hola, ¿cómo estás?'],
					['goodbye', 'adiós', 'Goodbye, see you later!', 'Adiós, ¡nos vemos!'],
					['please', 'por favor', 'Can you help me, please?', '¿Puedes ayudarme, por favor?'],
				],
			};

		case 'matching':
			return {
				data: [
					['Left', 'Right', 'Left Translation', 'Right Translation'],
					['hello', 'greeting', 'hola', 'saludo'],
					['goodbye', 'farewell', 'adiós', 'despedida'],
					['please', 'request', 'por favor', 'solicitud'],
				],
			};

		case 'roleplay':
			return {
				data: [
					['Speaker', 'Text', 'Translation'],
					['ai_0', 'Good evening! Welcome to our restaurant.', '¡Buenas noches! Bienvenido a nuestro restaurante.'],
					['student', 'Hello! Can I see the menu, please?', '¡Hola! ¿Puedo ver el menú, por favor?'],
					['ai_0', 'Of course! Here you go.', '¡Por supuesto! Aquí tienes.'],
					['student', 'Thank you!', '¡Gracias!'],
				],
			};

		case 'definition':
			return {
				data: [
					['Word', 'Hint/Definition'],
					['hello', 'A greeting used when meeting someone'],
					['goodbye', 'A farewell used when leaving'],
					['please', 'A polite word used when making a request'],
				],
			};

		case 'grammar':
			return {
				data: [
					['Pattern', 'Hint', 'Example'],
					['Subject + Verb + Object', 'Basic sentence structure', 'I eat an apple'],
					['Question: Do/Does + Subject + Verb?', 'Yes/No question format', 'Do you like pizza?'],
					['Past tense: Subject + Verb-ed', 'Regular past tense', 'I walked to school'],
				],
			};

		case 'sentence_writing':
			return {
				data: [
					['Word', 'Hint'],
					['hello', 'Use this word to greet someone'],
					['goodbye', 'Use this word when leaving'],
					['please', 'Use this word to be polite'],
				],
			};

		case 'summary':
			return {
				data: [
					['Article Title', 'Article Content'],
					['Sample Article', 'This is a sample article for summary drills. Replace this with your actual article content.'],
				],
			};

		default:
			return {
				data: [
					['Column 1', 'Column 2'],
					['Example 1', 'Example 2'],
				],
			};
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ type: string }> }
) {
	const resolvedParams = await params;
	return withRole(['tutor', 'admin'], (req, context) =>
		handler(req, context, resolvedParams)
	)(req);
}

