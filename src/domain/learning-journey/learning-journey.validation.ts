import { z } from "zod";
import {
  isKnownLearningJourneyTopicId,
  isValidPartTopicPair,
  type LearningJourneyPartId,
} from "./learning-journey.catalog";

export const learningJourneyPartSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const learningJourneyTopicSchema = z
  .string()
  .min(1)
  .refine(isKnownLearningJourneyTopicId, {
    message: "Invalid learning journey topic",
  });

export function refineLearningJourneyFields(
  data: {
    learning_journey_part?: LearningJourneyPartId;
    learning_journey_topic?: string;
    assigned_to?: string[];
  },
  ctx: z.RefinementCtx,
  options?: { requireWhenAssigned?: boolean },
): void {
  const requireWhenAssigned = options?.requireWhenAssigned ?? true;
  const isAssigning = (data.assigned_to?.length ?? 0) > 0;
  const part = data.learning_journey_part;
  const topic = data.learning_journey_topic;

  if (requireWhenAssigned && isAssigning) {
    if (part == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Learning journey part is required when assigning a drill",
        path: ["learning_journey_part"],
      });
    }
    if (!topic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Learning journey topic is required when assigning a drill",
        path: ["learning_journey_topic"],
      });
    }
  }

  if (part != null && topic) {
    if (!isValidPartTopicPair(part, topic)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Topic does not belong to the selected part",
        path: ["learning_journey_topic"],
      });
    }
  }

  if ((part != null && !topic) || (part == null && topic)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Learning journey part and topic must both be set or both omitted",
      path: ["learning_journey_part"],
    });
  }
}
