export type LearningJourneyPartId = 1 | 2 | 3 | 4;

export type LearningJourneyTopicId = string;

export type LearningJourneyTopic = {
  id: LearningJourneyTopicId;
  title: string;
  order: number;
  /** Optional alignment with Free Talk scenario types */
  freeTalkScenarioType?: string;
};

export type LearningJourneyPart = {
  part: LearningJourneyPartId;
  title: string;
  topics: LearningJourneyTopic[];
};

export const LEARNING_JOURNEY_PARTS: LearningJourneyPart[] = [
  {
    part: 1,
    title: "Communication with Patients",
    topics: [
      {
        id: "handling_emergency_critical",
        title: "Handling Emergency/Critical Situation",
        order: 1,
        freeTalkScenarioType: "icu_emergency",
      },
      {
        id: "conducting_cpr",
        title: "Conducting CPR",
        order: 2,
        freeTalkScenarioType: "cpr",
      },
      {
        id: "patient_follow_up",
        title: "Follow-up with Patients",
        order: 3,
        freeTalkScenarioType: "patient_follow_up",
      },
      {
        id: "admitting_patient",
        title: "Admitting a Patient",
        order: 4,
        freeTalkScenarioType: "admission",
      },
      {
        id: "small_talk_patient",
        title: "Small Talk with a Patient",
        order: 5,
        freeTalkScenarioType: "small_talk_patient",
      },
    ],
  },
  {
    part: 2,
    title: "Communication with Colleagues",
    topics: [
      {
        id: "receiving_handover",
        title: "Receiving an Handover",
        order: 1,
        freeTalkScenarioType: "handover_receive",
      },
      {
        id: "giving_handover",
        title: "Giving an Handover",
        order: 2,
        freeTalkScenarioType: "handover",
      },
      {
        id: "declining_request",
        title: "Declining a Request and Professionally Saying No",
        order: 3,
        freeTalkScenarioType: "decline_request",
      },
      {
        id: "small_talk_colleagues",
        title: "Small Talk with Colleagues",
        order: 4,
        freeTalkScenarioType: "small_talk_colleague",
      },
    ],
  },
  {
    part: 3,
    title: "Communication with Doctors, Families and Friends",
    topics: [
      {
        id: "providing_updates_doctor",
        title: "Providing Updates to a Doctor",
        order: 1,
        freeTalkScenarioType: "phone_doctor",
      },
      {
        id: "doctor_rounds",
        title: "Going on Rounds with Doctors",
        order: 2,
        freeTalkScenarioType: "doctor_rounds",
      },
      {
        id: "answering_family_questions",
        title: "Answering Families and Friend's Questions",
        order: 3,
        freeTalkScenarioType: "family_questions",
      },
    ],
  },
  {
    part: 4,
    title: "Bonus Scenarios",
    topics: [
      {
        id: "phone_colleagues",
        title: "Phone Communication with Colleagues",
        order: 1,
        freeTalkScenarioType: "phone_colleague",
      },
      {
        id: "phone_other_departments",
        title: "Phone Communication with Other Departments",
        order: 2,
        freeTalkScenarioType: "phone_department",
      },
      {
        id: "phone_patient_families",
        title: "Phone Communication with the Patient's Families",
        order: 3,
        freeTalkScenarioType: "phone_family",
      },
      {
        id: "grammar",
        title: "Grammar",
        order: 4,
      },
      {
        id: "interview_preparation",
        title: "Interview Preparation",
        order: 5,
      },
    ],
  },
];

const ALL_TOPIC_IDS = new Set(
  LEARNING_JOURNEY_PARTS.flatMap((p) => p.topics.map((t) => t.id)),
);

export function isLearningJourneyPartId(
  value: unknown,
): value is LearningJourneyPartId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function parseLearningJourneyPartId(
  value: unknown,
): LearningJourneyPartId | null {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return isLearningJourneyPartId(n) ? n : null;
}

export function getPartById(part: LearningJourneyPartId): LearningJourneyPart | undefined {
  return LEARNING_JOURNEY_PARTS.find((p) => p.part === part);
}

export function getTopicsForPart(part: LearningJourneyPartId): LearningJourneyTopic[] {
  return getPartById(part)?.topics ?? [];
}

export function getTopicById(
  topicId: string,
): (LearningJourneyTopic & { part: LearningJourneyPartId }) | undefined {
  for (const part of LEARNING_JOURNEY_PARTS) {
    const topic = part.topics.find((t) => t.id === topicId);
    if (topic) return { ...topic, part: part.part };
  }
  return undefined;
}

export function isValidPartTopicPair(
  part: LearningJourneyPartId,
  topicId: string,
): boolean {
  const partDef = getPartById(part);
  if (!partDef) return false;
  return partDef.topics.some((t) => t.id === topicId);
}

export function isKnownLearningJourneyTopicId(topicId: string): boolean {
  return ALL_TOPIC_IDS.has(topicId);
}

export function getMissionNumberLabel(part: LearningJourneyPartId): string {
  return `Mission ${part}`;
}

export function getPartLabel(part: LearningJourneyPartId): string {
  const def = getPartById(part);
  return def ? `${getMissionNumberLabel(part)}: ${def.title}` : getMissionNumberLabel(part);
}
