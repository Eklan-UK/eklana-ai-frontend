import { Types } from 'mongoose';
import { isValidUserId, toUserIdQuery } from '@/lib/api/user-id';

/** Scenarios without `allLearners` were created before per-learner assignment (treated as everyone). */
export function isFreeTalkScenarioForAllLearners(scenario: {
	allLearners?: boolean | null;
}): boolean {
	return scenario.allLearners !== false;
}

export function freeTalkScenarioVisibleToLearner(
	scenario: {
		allLearners?: boolean | null;
		assignedLearnerIds?: Types.ObjectId[] | string[] | null;
	},
	learnerUserId: Types.ObjectId | string,
): boolean {
	if (isFreeTalkScenarioForAllLearners(scenario)) return true;
	const ids = scenario.assignedLearnerIds ?? [];
	return ids.some((id) => String(id) === learnerUserId.toString());
}

/** Scenarios still within their completion window (legacy rows without date stay visible). */
export function freeTalkScenarioActiveDateFilter() {
	const now = new Date();
	return {
		$or: [{ completionDate: { $exists: false } }, { completionDate: { $gt: now } }],
	};
}

/**
 * Mongo filter: scenarios visible to a learner (user id), not yet expired.
 * Accepts UUID (Better Auth web/OAuth) or ObjectId (legacy/mobile) learner ids.
 */
export function freeTalkScenarioLearnerFilter(learnerUserId: Types.ObjectId | string) {
	return {
		$and: [
			freeTalkScenarioActiveDateFilter(),
			{
				$or: [
					{ allLearners: { $ne: false } },
					{ assignedLearnerIds: toUserIdQuery(learnerUserId.toString()) },
				],
			},
		],
	};
}

/**
 * Normalizes assigned learner ids for storage. Accepts both ObjectId hex
 * strings (legacy/mobile users) and UUID strings (Better Auth web sign-up,
 * incl. Google/Apple OAuth) — previously UUID ids were silently dropped
 * here, meaning free-talk scenarios could never be assigned to those users.
 */
export function normalizeAssignedLearnerIds(ids: unknown): Array<Types.ObjectId | string> {
	if (!Array.isArray(ids)) return [];
	const out: Array<Types.ObjectId | string> = [];
	for (const id of ids) {
		const s = String(id ?? '').trim();
		if (s && isValidUserId(s)) {
			out.push(toUserIdQuery(s));
		}
	}
	return out;
}
