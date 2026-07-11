import { getDrillTopicTitle } from '@/lib/drill-display-label';

type DrillLike = {
	learning_journey_topic?: string | null;
	scenarioType?: string | null;
	topicTitle?: string | null;
};

function isDrillLike(value: unknown): value is DrillLike {
	return value != null && typeof value === 'object';
}

/**
 * Adds server-resolved `topicTitle` to the drill subdocument for learner API rows.
 */
export function enrichLearnerDrillRowWithTopicTitle<T extends { drill?: unknown }>(
	row: T,
): T {
	if (!isDrillLike(row.drill)) {
		return row;
	}

	const topicTitle = getDrillTopicTitle(row.drill);
	if (!topicTitle) {
		return row;
	}

	return {
		...row,
		drill: {
			...row.drill,
			topicTitle,
		},
	};
}

export function enrichLearnerDrillRowsWithTopicTitle<T extends { drill?: unknown }>(
	rows: T[],
): T[] {
	return rows.map(enrichLearnerDrillRowWithTopicTitle);
}
