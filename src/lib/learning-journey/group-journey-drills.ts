import {
  getTopicsForPart,
  type LearningJourneyPartId,
  type LearningJourneyTopic,
} from "@/domain/learning-journey/learning-journey.catalog";
import {
  isCompletedPlanItem,
  sortAssignedPlanItems,
} from "@/lib/learner-assigned-plan";
import type { LearnerMyDrillRow } from "@/lib/server/learner-my-drills.server";

export type JourneyDrillItem = LearnerMyDrillRow & {
  drill: LearnerMyDrillRow["drill"] & {
    learning_journey_part?: LearningJourneyPartId;
    learning_journey_topic?: string;
  };
};

export type JourneyTopicGroup = {
  topic: LearningJourneyTopic;
  items: JourneyDrillItem[];
};

function drillBelongsToPart(item: JourneyDrillItem, part: LearningJourneyPartId): boolean {
  const drill = item.drill as { learning_journey_part?: number } | undefined;
  return drill?.learning_journey_part === part;
}

export function filterDrillsForPart(
  drills: JourneyDrillItem[],
  part: LearningJourneyPartId,
): JourneyDrillItem[] {
  return drills.filter((item) => drillBelongsToPart(item, part));
}

export function groupDrillsByJourney(
  drills: JourneyDrillItem[],
  part: LearningJourneyPartId,
): JourneyTopicGroup[] {
  const partDrills = filterDrillsForPart(drills, part);
  const topics = getTopicsForPart(part);

  return topics.map((topic) => ({
    topic,
    items: sortAssignedPlanItems(
      partDrills.filter((item) => {
        const drill = item.drill as { learning_journey_topic?: string } | undefined;
        return drill?.learning_journey_topic === topic.id;
      }),
    ),
  }));
}

export function countPartJourneyProgress(
  drills: JourneyDrillItem[],
  part: LearningJourneyPartId,
): { completed: number; total: number } {
  const partDrills = filterDrillsForPart(drills, part);
  const completed = partDrills.filter((item) => isCompletedPlanItem(item)).length;
  return { completed, total: partDrills.length };
}

export function filterBookmarkedDrills(drills: JourneyDrillItem[]): JourneyDrillItem[] {
  return sortAssignedPlanItems(drills.filter((item) => item.hasBookmarks === true));
}
