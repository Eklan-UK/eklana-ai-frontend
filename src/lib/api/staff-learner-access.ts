import { Types } from 'mongoose';
import Profile from '@/models/profile';
import User from '@/models/user';
import {
	getAssignedLearnerIdsForTutor,
	isTutorAssignedToLearner,
} from '@/domain/tutor-assignments/tutor-assignment.service';

export type StaffContext = { userId: Types.ObjectId | string; userRole: string };

export type TutorScopedLearnerIdsResult =
	| { ok: true; learnerIds: string[] | undefined }
	| { ok: false };

function toTutorObjectId(userId: Types.ObjectId | string): Types.ObjectId {
	return userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);
}

/**
 * Admin learner URLs and tutor student URLs normally use {@link User} `_id`.
 * If the path param is a {@link Profile} document `_id`, resolve to `Profile.userId`
 * so AiSession and other learner-scoped queries match persisted data.
 */
export async function resolveLearnerIdToUserIdString(learnerId: string): Promise<string> {
	if (!learnerId || !Types.ObjectId.isValid(learnerId)) return learnerId;
	const oid = new Types.ObjectId(learnerId);
	const user = await User.findById(oid).select('_id').lean().exec();
	if (user?._id) return user._id.toString();
	const profile = await Profile.findById(oid).select('userId').lean().exec();
	if (profile?.userId) return String(profile.userId);
	return learnerId;
}

/**
 * Admin may read any learner. Tutor may read only if they have an active
 * TutorAssignment for the learner (falls back to legacy Profile.tutorId).
 */
export async function assertStaffCanReadLearner(
	context: StaffContext,
	learnerId: string
): Promise<'ok' | 'forbidden'> {
	if (context.userRole === 'admin') return 'ok';
	if (context.userRole === 'tutor') {
		const assigned = await isTutorAssignedToLearner(
			toTutorObjectId(context.userId),
			new Types.ObjectId(learnerId)
		);
		return assigned ? 'ok' : 'forbidden';
	}
	return 'forbidden';
}

/**
 * Admin may act on any learners. Tutor may act only if they have an active
 * assignment for every ID (falls back to legacy Profile.tutorId).
 */
export async function assertStaffCanActOnLearners(
	context: StaffContext,
	learnerIds: string[]
): Promise<'ok' | 'forbidden'> {
	if (context.userRole === 'admin') return 'ok';
	if (context.userRole !== 'tutor') return 'forbidden';

	const tutorId = toTutorObjectId(context.userId);
	const results = await Promise.all(
		learnerIds.map((learnerId) =>
			isTutorAssignedToLearner(tutorId, new Types.ObjectId(learnerId))
		)
	);
	return results.every(Boolean) ? 'ok' : 'forbidden';
}

/**
 * Resolve learner IDs for list/analytics endpoints.
 * Admin: requested IDs as-is, or `undefined` if omitted (all learners).
 * Tutor: omitted → all assigned IDs; provided → those IDs if every one is on
 * the roster, otherwise forbidden.
 */
export async function resolveTutorScopedLearnerIds(
	context: StaffContext,
	requestedIds?: string[]
): Promise<TutorScopedLearnerIdsResult> {
	if (context.userRole === 'admin') {
		return { ok: true, learnerIds: requestedIds };
	}
	if (context.userRole !== 'tutor') {
		return { ok: false };
	}

	const { learnerIds: assigned } = await getAssignedLearnerIdsForTutor(
		toTutorObjectId(context.userId),
		{ limit: Number.MAX_SAFE_INTEGER, offset: 0 }
	);
	const assignedStrings = assigned.map((id) => id.toString());

	if (requestedIds == null) {
		return { ok: true, learnerIds: assignedStrings };
	}

	const assignedSet = new Set(assignedStrings);
	if (requestedIds.some((id) => !assignedSet.has(id))) {
		return { ok: false };
	}
	return { ok: true, learnerIds: requestedIds };
}
