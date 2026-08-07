// GET /api/v1/precision-clinic/stats — dashboard card counts (admin only)
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';

const PC_SOURCE = { source: 'precision_clinic' as const };

function len(arr: unknown): number {
	return Array.isArray(arr) ? arr.length : 0;
}

/** Best-effort practice-item count from general Drill content fields. */
function countDrillPracticeItems(drill: {
	target_sentences?: unknown;
	pronunciation_items?: unknown;
	matching_pairs?: unknown;
	definition_items?: unknown;
	grammar_items?: unknown;
	sentence_writing_items?: unknown;
	fill_blank_items?: unknown;
	key_phrase_items?: unknown;
	roleplay_scenes?: unknown;
	roleplay_dialogue?: unknown;
	listening_drill_content?: string;
	listening_drill_title?: string;
	article_content?: string;
	article_title?: string;
	sentence_drill_word?: string;
}): number {
	const fromArrays =
		len(drill.target_sentences) +
		len(drill.pronunciation_items) +
		len(drill.matching_pairs) +
		len(drill.definition_items) +
		len(drill.grammar_items) +
		len(drill.sentence_writing_items) +
		len(drill.fill_blank_items) +
		len(drill.key_phrase_items) +
		len(drill.roleplay_scenes);

	if (fromArrays > 0) return fromArrays;

	if (drill.listening_drill_content || drill.listening_drill_title) return 1;
	if (drill.article_content || drill.article_title) return 1;
	if (drill.sentence_drill_word) return 1;
	if (len(drill.roleplay_dialogue) > 0) return 1;

	return 0;
}

async function getHandler(
	_req: NextRequest,
	_context: { userId: string; userRole: string }
) {
	await connectToDatabase();

	const [drills, assigned, publishedDrillIds] = await Promise.all([
		Drill.find(PC_SOURCE)
			.select(
				'target_sentences pronunciation_items matching_pairs definition_items grammar_items sentence_writing_items fill_blank_items key_phrase_items roleplay_scenes roleplay_dialogue listening_drill_content listening_drill_title article_content article_title sentence_drill_word'
			)
			.lean()
			.exec(),
		DrillAssignment.countDocuments(PC_SOURCE),
		DrillAssignment.distinct('drillId', PC_SOURCE),
	]);

	let practiceItems = 0;
	for (const drill of drills) {
		practiceItems += countDrillPracticeItems(drill);
	}

	const published = Array.isArray(publishedDrillIds)
		? publishedDrillIds.length
		: 0;

	return apiResponse.success({
		total: drills.length,
		practiceItems,
		published,
		assigned,
	});
}

export const GET = withRole(['admin'], withErrorHandler(getHandler));
