// GET /api/v1/precision-clinic/stats — dashboard card counts (admin only)
import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { countDrillPracticeItems } from '@/lib/drills/count-practice-items';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';

const PC_SOURCE = { source: 'precision_clinic' as const };

async function getHandler(
	_req: NextRequest,
	_context: { userId: string; userRole: string }
) {
	await connectToDatabase();

	const [drills, assigned, publishedAgg] = await Promise.all([
		Drill.find(PC_SOURCE)
			.select(
				'target_sentences pronunciation_items matching_pairs definition_items grammar_items sentence_writing_items fill_blank_items key_phrase_items roleplay_scenes roleplay_dialogue listening_drill_content listening_drill_title article_content article_title sentence_drill_word'
			)
			.lean()
			.exec(),
		DrillAssignment.countDocuments(PC_SOURCE),
		DrillAssignment.aggregate([
			{ $match: PC_SOURCE },
			{ $group: { _id: '$drillId' } },
			{ $count: 'count' },
		]),
	]);

	let practiceItems = 0;
	for (const drill of drills) {
		practiceItems += countDrillPracticeItems(drill);
	}

	const published = publishedAgg[0]?.count ?? 0;

	return apiResponse.success({
		total: drills.length,
		practiceItems,
		published,
		assigned,
	});
}

export const GET = withRole(['admin'], withErrorHandler(getHandler));
