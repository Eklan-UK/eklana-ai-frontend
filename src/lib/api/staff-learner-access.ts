import { Types } from 'mongoose';
import Profile from '@/models/profile';
import User from '@/models/user';

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
 * Admin may read any learner. Tutor may read only if Profile links learner to that tutor
 * (same pattern as /api/v1/tutor/students/[studentId]).
 */
export async function assertStaffCanReadLearner(
	context: StaffContext,
	learnerId: string
): Promise<'ok' | 'forbidden'> {
	if (context.userRole === 'admin') return 'ok';
	if (context.userRole === 'tutor') {
		const link = await Profile.findOne({
			userId: new Types.ObjectId(learnerId),
			tutorId: context.userId,
		})
			.select('_id')
			.lean()
			.exec();
		return link ? 'ok' : 'forbidden';
	}
	return 'forbidden';
}
