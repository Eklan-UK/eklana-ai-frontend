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
  z.literal(5),
]);

export const learningJourneyTopicSchema = z
  .string()
  .min(1)
  .refine(isKnownLearningJourneyTopicId, {
    message: "Invalid learning journey topic",
  });

export function refineEnrollmentForLearners(
  data: {
    learning_journey_part?: LearningJourneyPartId;
    assigned_to?: string[];
  },
  enrolledPartsByLearner: Map<string, LearningJourneyPartId[]>,
  ctx: z.RefinementCtx,
): void {
  const part = data.learning_journey_part;
  const assignedTo = data.assigned_to ?? [];
  if (part == null || assignedTo.length === 0) return;

  const notEnrolled = assignedTo.filter((learnerId) => {
    const parts = enrolledPartsByLearner.get(learnerId) ?? [];
    return !parts.includes(part);
  });

  if (notEnrolled.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Learners not enrolled in mission ${part}: ${notEnrolled.join(', ')}`,
      path: ['assigned_to'],
    });
  }
}

export function refineLearningJourneyFields(
  data: {
    learning_journey_part?: LearningJourneyPartId;
    learning_journey_topic?: string;
    assigned_to?: string[];
  },
  ctx: z.RefinementCtx,
  options?: {
    requireWhenAssigned?: boolean;
    requireAlways?: boolean;
    enrolledPartsByLearner?: Map<string, LearningJourneyPartId[]>;
  },
): void {
  const requireWhenAssigned = options?.requireWhenAssigned ?? true;
  const requireAlways = options?.requireAlways ?? false;
  const isAssigning = (data.assigned_to?.length ?? 0) > 0;
  const part = data.learning_journey_part;
  const topic = data.learning_journey_topic;

  if (requireAlways || (requireWhenAssigned && isAssigning)) {
    if (part == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Learning journey mission is required",
        path: ["learning_journey_part"],
      });
    }
    if (!topic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Learning journey topic is required",
        path: ["learning_journey_topic"],
      });
    }
  }

  if (part != null && topic) {
    if (!isValidPartTopicPair(part, topic)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Topic does not belong to the selected mission",
        path: ["learning_journey_topic"],
      });
    }
  }

  if ((part != null && !topic) || (part == null && topic)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Learning journey mission and topic must both be set or both omitted",
      path: ["learning_journey_part"],
    });
  }

  if (options?.enrolledPartsByLearner) {
    refineEnrollmentForLearners(data, options.enrolledPartsByLearner, ctx);
  }
}
