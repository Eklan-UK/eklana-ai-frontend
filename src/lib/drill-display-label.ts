import { LEARNING_JOURNEY_PARTS } from '@/domain/learning-journey/learning-journey.catalog';

interface DrillLike {
	learning_journey_part?: number | null;
	learning_journey_topic?: string | null;
}

/**
 * Returns a human-readable label for a drill based on its learning journey part and topic,
 * e.g. "Part 1 — Follow-up with Patients" or "Part 2 — Giving Handover".
 * Falls back to "Part {N}" if the topic id is unknown.
 * Returns null if neither part nor topic is present.
 */
export function drillDisplayLabel(drill: DrillLike | null | undefined): string | null {
	if (!drill) return null;

	const partNum = drill.learning_journey_part;
	if (!partNum) return null;

	const topicId = drill.learning_journey_topic;
	const partDef = LEARNING_JOURNEY_PARTS.find(p => p.part === partNum);

	if (!topicId || !partDef) {
		return `Part ${partNum}`;
	}

	const topic = partDef.topics.find(t => t.id === topicId);
	const topicTitle = topic?.title ?? null;

	if (!topicTitle) {
		return `Part ${partNum}`;
	}

	return `Part ${partNum} — ${topicTitle}`;
}
