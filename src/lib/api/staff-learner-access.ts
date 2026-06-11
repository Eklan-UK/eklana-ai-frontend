import { Types } from 'mongoose';
import Profile from '@/models/profile';
import User from '@/models/user';
import { isTutorAssignedToLearner } from '@/domain/tutor-assignments/tutor-assignment.service';

type StaffContext = { userId: Types.ObjectId; userRole: string };

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
			context.userId,
			new Types.ObjectId(learnerId)
		);
		return assigned ? 'ok' : 'forbidden';
	}
	return 'forbidden';
}
