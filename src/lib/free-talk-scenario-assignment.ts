import { Types } from 'mongoose';

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
	learnerUserId: Types.ObjectId,
): boolean {
	if (isFreeTalkScenarioForAllLearners(scenario)) return true;
	const ids = scenario.assignedLearnerIds ?? [];
	return ids.some((id) => String(id) === learnerUserId.toString());
}

/** Mongo filter: scenarios visible to a learner (user id). */
export function freeTalkScenarioLearnerFilter(learnerUserId: Types.ObjectId) {
	return {
		$or: [
			{ allLearners: { $ne: false } },
			{ assignedLearnerIds: learnerUserId },
		],
	};
}

export function normalizeAssignedLearnerIds(ids: unknown): Types.ObjectId[] {
	if (!Array.isArray(ids)) return [];
	const out: Types.ObjectId[] = [];
	for (const id of ids) {
		const s = String(id ?? '').trim();
		if (s && Types.ObjectId.isValid(s)) {
			out.push(new Types.ObjectId(s));
		}
	}
	return out;
}
