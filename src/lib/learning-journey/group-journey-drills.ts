import {
  getTopicsForPart,
  type LearningJourneyPartId,
  type LearningJourneyTopic,
} from "@/domain/learning-journey/learning-journey.catalog";
import {
  isCompletedPlanItem,
  isFreeTalkPlanItem,
  sortAssignedPlanItems,
} from "@/lib/learner-assigned-plan";
import type { LearnerMyDrillRow } from "@/lib/server/learner-my-drills.server";

/** Drill subdocument shape needed by the journey utilities. */
type JourneyDrillDoc = {
  _id?: string;
  type?: string;
  date?: string | Date | null;
  title?: string;
  scenarioType?: string;
  completionDate?: string | null;
  learning_journey_part?: LearningJourneyPartId;
  learning_journey_topic?: string;
};

/**
 * A learner drill row whose `drill` field is narrowed to include the
 * learning-journey metadata fields alongside the base shape.
 */
export type JourneyDrillItem = Omit<LearnerMyDrillRow, "drill"> & {
  drill: JourneyDrillDoc;
};

export type JourneyTopicGroup = {
  topic: LearningJourneyTopic;
  items: JourneyDrillItem[];
};

function drillBelongsToPart(
  item: JourneyDrillItem,
  part: LearningJourneyPartId,
): boolean {
  return item.drill?.learning_journey_part === part;
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
      partDrills.filter(
        (item) => item.drill?.learning_journey_topic === topic.id,
      ),
    ) as JourneyDrillItem[],
  }));
}

export function countPartJourneyProgress(
  drills: JourneyDrillItem[],
  part: LearningJourneyPartId,
): { completed: number; total: number } {
  const partDrills = filterDrillsForPart(drills, part);
  const completed = partDrills.filter((item) =>
    isCompletedPlanItem(item),
  ).length;
  return { completed, total: partDrills.length };
}

export function filterBookmarkedDrills(
  drills: JourneyDrillItem[],
): JourneyDrillItem[] {
  return sortAssignedPlanItems(
    drills.filter((item) => item.hasBookmarks === true),
  ) as JourneyDrillItem[];
}

export { isFreeTalkPlanItem };
