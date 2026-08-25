// GET /api/v1/precision-clinic/stats — dashboard card counts (admin + tutor)
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { apiResponse } from '@/lib/api/response';
import { countDrillPracticeItems } from '@/lib/drills/count-practice-items';
import { resolveTutorScopedLearnerIds } from '@/lib/api/staff-learner-access';
import { toUserIdQueryMulti } from '@/lib/api/user-id';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';

const PC_SOURCE = { source: 'precision_clinic' as const };

async function getHandler(
	_req: NextRequest,
	context: { userId: string; userRole: string }
) {
	await connectToDatabase();

	const scoped = await resolveTutorScopedLearnerIds(context);
	if (!scoped.ok) {
		return apiResponse.notFound('Stats');
	}

	const learnerFilter =
		scoped.learnerIds != null
			? { learnerId: { $in: toUserIdQueryMulti(scoped.learnerIds) } }
			: {};

	if (scoped.learnerIds != null && scoped.learnerIds.length === 0) {
		return apiResponse.success({
			total: 0,
			practiceItems: 0,
			published: 0,
			assigned: 0,
		});
	}

	const assignmentMatch = { ...PC_SOURCE, ...learnerFilter };

	const [assigned, publishedAgg] = await Promise.all([
		DrillAssignment.countDocuments(assignmentMatch),
		DrillAssignment.aggregate([
			{ $match: assignmentMatch },
			{ $group: { _id: '$drillId' } },
			{ $count: 'count' },
		]),
	]);

	let drills;
	if (scoped.learnerIds != null) {
		const drillIds = await DrillAssignment.distinct('drillId', assignmentMatch);
		const validIds = drillIds.filter(
			(id): id is Types.ObjectId => id != null && Types.ObjectId.isValid(id)
		);
		drills = await Drill.find({ _id: { $in: validIds }, ...PC_SOURCE })
			.select(
				'target_sentences pronunciation_items matching_pairs definition_items grammar_items sentence_writing_items fill_blank_items key_phrase_items roleplay_scenes roleplay_dialogue listening_drill_content listening_drill_title article_content article_title sentence_drill_word'
			)
			.lean()
			.exec();
	} else {
		drills = await Drill.find(PC_SOURCE)
			.select(
				'target_sentences pronunciation_items matching_pairs definition_items grammar_items sentence_writing_items fill_blank_items key_phrase_items roleplay_scenes roleplay_dialogue listening_drill_content listening_drill_title article_content article_title sentence_drill_word'
			)
			.lean()
			.exec();
	}

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

export const GET = withRole(['admin', 'tutor'], withErrorHandler(getHandler));
