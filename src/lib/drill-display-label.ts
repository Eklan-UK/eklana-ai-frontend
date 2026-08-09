import {
	LEARNING_JOURNEY_PARTS,
	getMissionNumberLabel,
	getTopicById,
	parseLearningJourneyPartId,
} from '@/domain/learning-journey/learning-journey.catalog';
import { getDrillTypeLabel } from '@/utils/drill';

interface DrillLike {
	learning_journey_part?: number | null;
	learning_journey_topic?: string | null;
}

export interface DrillTopicLike {
	learning_journey_topic?: string | null;
	scenarioType?: string | null;
}

export interface DrillNotificationLabelInput {
	title?: string | null;
	type?: string | null;
	learning_journey_part?: number | null;
	learning_journey_topic?: string | null;
	scenarioType?: string | null;
}

/** Treat blank titles and "Untitled*" placeholders as absent. */
export function resolveRealDrillTitle(title?: string | null): string | null {
	const trimmed = title?.trim();
	if (!trimmed) return null;
	if (/^untitled/i.test(trimmed)) return null;
	return trimmed;
}

export interface DrillListTitleInput {
	title?: string | null;
	type?: string | null;
	topicTitle?: string | null;
	learning_journey_topic?: string | null;
	scenarioType?: string | null;
}

/**
 * List-row title: real drill title, else topic name, else type label.
 * Used for Learning Journey section navs and admin review lists (display-only; no DB writes).
 */
export function resolveDrillListTitle(
	drill: DrillListTitleInput | null | undefined,
): string {
	const realTitle = resolveRealDrillTitle(drill?.title);
	if (realTitle) return realTitle;

	const topicFromProp = drill?.topicTitle?.trim();
	if (topicFromProp) return topicFromProp;

	const topicFromCatalog = getDrillTopicTitle(drill);
	if (topicFromCatalog) return topicFromCatalog;

	return getDrillTypeLabel(drill?.type);
}

/**
 * Returns the catalog topic title for a drill, e.g. "Handling Emergency/Critical Situation".
 * Resolves from learning_journey_topic slug, or Free Talk scenarioType via catalog mapping.
 */
export function getDrillTopicTitle(
	drill: DrillTopicLike | null | undefined,
): string | null {
	if (!drill) return null;

	const topicId = drill.learning_journey_topic;
	if (topicId) {
		return getTopicById(topicId)?.title ?? null;
	}

	const scenarioType = drill.scenarioType;
	if (scenarioType) {
		for (const part of LEARNING_JOURNEY_PARTS) {
			const topic = part.topics.find(
				(t) => t.freeTalkScenarioType === scenarioType,
			);
			if (topic) return topic.title;
		}
	}

	return null;
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

/**
 * Student-facing notification label: type · mission · topic · title?
 * Never returns "Untitled"; falls back to type label only when needed.
 */
export function formatDrillNotificationLabel(
	drill: DrillNotificationLabelInput | null | undefined,
): string {
	const parts: string[] = [getDrillTypeLabel(drill?.type)];

	const partId = parseLearningJourneyPartId(drill?.learning_journey_part);
	if (partId != null) {
		parts.push(getMissionNumberLabel(partId));
	}

	const topicTitle = getDrillTopicTitle(drill);
	if (topicTitle) {
		parts.push(topicTitle);
	}

	const realTitle = resolveRealDrillTitle(drill?.title);
	if (realTitle) {
		parts.push(realTitle);
	}

	return parts.join(' · ');
}
