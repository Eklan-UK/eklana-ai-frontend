import {
  LEARNING_JOURNEY_PARTS,
  getPartLabel,
  type LearningJourneyPartId,
} from "@/domain/learning-journey/learning-journey.catalog";

export type AiJourneyMapping = {
  journeyPart: LearningJourneyPartId | "";
  journeyTopic: string;
};

/**
 * Maps AI form Part/Topic label strings to learning journey catalog IDs.
 */
export function mapAiPartTopicToJourney(
  aiPart: string,
  aiTopic: string,
): AiJourneyMapping {
  let journeyPart: LearningJourneyPartId | "" = "";
  let journeyTopic = "";

  for (const partDef of LEARNING_JOURNEY_PARTS) {
    const partLabel = getPartLabel(partDef.part);
    if (aiPart === partLabel || aiPart === `Part ${partDef.part}: ${partDef.title}`) {
      journeyPart = partDef.part;
      const topic = partDef.topics.find((t) => t.title === aiTopic);
      if (topic) {
        journeyTopic = topic.id;
      }
      break;
    }
  }

  return { journeyPart, journeyTopic };
}
