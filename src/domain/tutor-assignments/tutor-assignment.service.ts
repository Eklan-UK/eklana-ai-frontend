import { Types } from 'mongoose';
import TutorAssignment from '@/models/tutor-assignment';
import Profile from '@/models/profile';
import { logger } from '@/lib/api/logger';

/**
 * Idempotently assign a learner to a tutor.
 * If an active assignment already exists, returns it without creating a duplicate.
 */
export async function assignLearnerToTutor({
	learnerId,
	tutorId,
	assignedBy,
}: {
	learnerId: Types.ObjectId;
	tutorId: Types.ObjectId;
	assignedBy: Types.ObjectId;
}) {
	const existing = await TutorAssignment.findOne({
		learnerId,
		tutorId,
		status: 'active',
	}).exec();

	if (existing) {
		return existing;
	}

	const assignment = await TutorAssignment.create({
		learnerId,
		tutorId,
		assignedBy,
		assignedAt: new Date(),
		status: 'active',
	});

	logger.info('Tutor assigned to learner', {
		learnerId: learnerId.toString(),
		tutorId: tutorId.toString(),
		assignedBy: assignedBy.toString(),
	});

	return assignment;
}

/**
 * End an active assignment between a tutor and learner.
 * Silently succeeds if no active assignment exists.
 */
export async function unassignLearnerFromTutor({
	learnerId,
	tutorId,
}: {
	learnerId: Types.ObjectId;
	tutorId: Types.ObjectId;
}) {
	const result = await TutorAssignment.findOneAndUpdate(
		{ learnerId, tutorId, status: 'active' },
		{ $set: { status: 'ended', endedAt: new Date() } },
		{ new: true }
	).exec();

	if (result) {
		logger.info('Tutor unassigned from learner', {
			learnerId: learnerId.toString(),
			tutorId: tutorId.toString(),
		});
	}

	return result;
}

/**
 * Returns the user-IDs of all learners actively assigned to a tutor.
 */
export async function getActiveLearnerIdsForTutor(
	tutorId: Types.ObjectId
): Promise<Types.ObjectId[]> {
	const assignments = await TutorAssignment.find({ tutorId, status: 'active' })
		.select('learnerId')
		.lean()
		.exec();
	return assignments.map((a) => a.learnerId);
}

/**
 * Returns a deduplicated, paginated list of learner IDs for a tutor.
 * Sources:
 *   1. Active TutorAssignment rows (new admin-assigned path)
 *   2. Legacy Profile.tutorId entries (older learners never migrated)
 * Pagination is applied after deduplication so counts are stable.
 */
export async function getAssignedLearnerIdsForTutor(
	tutorId: Types.ObjectId,
	{ limit, offset }: { limit: number; offset: number }
): Promise<{ learnerIds: Types.ObjectId[]; total: number }> {
	const [assignments, legacyProfiles] = await Promise.all([
		TutorAssignment.find({ tutorId, status: 'active' })
			.select('learnerId assignedAt')
			.sort({ assignedAt: -1 })
			.lean()
			.exec(),
		Profile.find({ tutorId })
			.select('userId createdAt')
			.lean()
			.exec(),
	]);

	// Build a deduped ordered list: TutorAssignment entries first, then legacy-only entries
	const seen = new Set<string>();
	const ordered: Types.ObjectId[] = [];

	for (const a of assignments) {
		const key = a.learnerId.toString();
		if (!seen.has(key)) {
			seen.add(key);
			ordered.push(a.learnerId);
		}
	}

	for (const p of legacyProfiles) {
		const key = p.userId.toString();
		if (!seen.has(key)) {
			seen.add(key);
			ordered.push(new Types.ObjectId(p.userId.toString()));
		}
	}

	const total = ordered.length;
	const learnerIds = ordered.slice(offset, offset + limit);

	return { learnerIds, total };
}

/**
 * Returns the tutor IDs of all tutors actively assigned to a learner.
 */
export async function getActiveTutorIdsForLearner(
	learnerId: Types.ObjectId
): Promise<Types.ObjectId[]> {
	const assignments = await TutorAssignment.find({ learnerId, status: 'active' })
		.select('tutorId')
		.lean()
		.exec();
	return assignments.map((a) => a.tutorId);
}

/**
 * Check whether a specific tutor has an active assignment for a given learner.
 * Falls back to the legacy Profile.tutorId field so existing data keeps working.
 */
export async function isTutorAssignedToLearner(
	tutorId: Types.ObjectId,
	learnerId: Types.ObjectId
): Promise<boolean> {
	const assignment = await TutorAssignment.findOne({
		tutorId,
		learnerId,
		status: 'active',
	})
		.select('_id')
		.lean()
		.exec();

	if (assignment) return true;

	// Legacy fallback: Profile.tutorId
	const profile = await Profile.findOne({ userId: learnerId, tutorId })
		.select('_id')
		.lean()
		.exec();

	return !!profile;
}

/**
 * If a learner has a Profile.tutorId but no active TutorAssignment, create one
 * so the learner automatically appears in their legacy tutor's student list.
 * This is idempotent and safe to call on every request.
 */
export async function migrateLegacyProfileTutorId(
	learnerId: Types.ObjectId
): Promise<void> {
	const profile = await Profile.findOne({ userId: learnerId })
		.select('tutorId')
		.lean()
		.exec();

	if (!profile?.tutorId) return;

	const tutorId = new Types.ObjectId(profile.tutorId.toString());

	const existing = await TutorAssignment.findOne({
		learnerId,
		tutorId,
		status: 'active',
	})
		.select('_id')
		.lean()
		.exec();

	if (existing) return;

	await TutorAssignment.create({
		learnerId,
		tutorId,
		assignedBy: tutorId, // best guess; tutor "self-assigned" via legacy data
		assignedAt: new Date(),
		status: 'active',
	});

	logger.info('Migrated legacy Profile.tutorId to TutorAssignment', {
		learnerId: learnerId.toString(),
		tutorId: tutorId.toString(),
	});
}
