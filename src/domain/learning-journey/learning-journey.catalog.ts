export type LearningJourneyPartId = 1 | 2 | 3 | 4 | 5;

export type LearningJourneyTopicId = string;

export type LearningJourneyTopic = {
  id: LearningJourneyTopicId;
  title: string;
  order: number;
  /** Optional alignment with Free Talk scenario types */
  freeTalkScenarioType?: string;
};

/** Lucide icon keys for mission timeline nodes (Figma accents). */
export type MissionThemeIconKey =
  | "stethoscope"
  | "users"
  | "message"
  | "clipboard"
  | "star";

export type MissionVisualStatus =
  | "locked"
  | "active"
  | "completed"
  | "journeyComplete";

export type MissionCtaLabel = "start" | "continue";

export type MissionProgress = {
  completed: number;
  total: number;
};

export type DerivedMissionState = {
  part: LearningJourneyPartId;
  status: MissionVisualStatus;
  /** 0–100, rounded */
  percent: number;
  /** Lowest incomplete enrolled mission — View Details / ring emphasis only */
  isCurrent: boolean;
  /** Active missions: Start at 0%, Continue otherwise; null when not active */
  ctaLabel: MissionCtaLabel | null;
  completed: number;
  total: number;
  accent: string;
  icon: MissionThemeIconKey;
};

/** Completed rail / node / bar accent from Figma */
export const MISSION_COMPLETED_ACCENT = "#2a602c";

/** Locked / track rail gray from Figma */
export const MISSION_LOCKED_RAIL = "#e0e0e0";

/**
 * Color for the rail segment from mission `i` down to mission `i+1`.
 * Green when completed, mission accent when active, gray when locked.
 */
export function railSegmentColor(
  status: MissionVisualStatus,
  accent: string,
): string {
  if (status === "completed" || status === "journeyComplete") {
    return MISSION_COMPLETED_ACCENT;
  }
  if (status === "active") {
    return accent;
  }
  return MISSION_LOCKED_RAIL;
}

export type LearningJourneyPart = {
  part: LearningJourneyPartId;
  title: string;
  /** Figma mission accent (active state) */
  accent: string;
  icon: MissionThemeIconKey;
  topics: LearningJourneyTopic[];
};

export const LEARNING_JOURNEY_PARTS: LearningJourneyPart[] = [
  {
    part: 1,
    title: "Communication with Patients",
    accent: "#3b82f6",
    icon: "stethoscope",
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
    accent: "#ff7a00",
    icon: "users",
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
    accent: "#a855f7",
    icon: "message",
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
    title: "Interview Preparation",
    accent: "#3b82f6",
    icon: "clipboard",
    topics: [
      {
        id: "motivation_prep",
        title: "Motivation prep",
        order: 1,
      },
      {
        id: "technical_prep",
        title: "Technical prep",
        order: 2,
      },
      {
        id: "situation_judgement_prep",
        title: "Situation Judgement Prep",
        order: 3,
      },
      {
        id: "mock_1",
        title: "Mock 1",
        order: 4,
      },
      {
        id: "mock_2",
        title: "Mock 2",
        order: 5,
      },
      {
        id: "mock_3",
        title: "Mock 3",
        order: 6,
      },
      {
        id: "mock_4",
        title: "Mock 4",
        order: 7,
      },
      {
        id: "mock_5",
        title: "Mock 5",
        order: 8,
      },
    ],
  },
  {
    part: 5,
    title: "Bonus Scenarios",
    accent: "#ff7a00",
    icon: "star",
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
    ],
  },
];

const ALL_TOPIC_IDS = new Set(
  LEARNING_JOURNEY_PARTS.flatMap((p) => p.topics.map((t) => t.id)),
);

export function isLearningJourneyPartId(
  value: unknown,
): value is LearningJourneyPartId {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
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

function resolveProgress(
  progressByPart:
    | Partial<Record<LearningJourneyPartId, MissionProgress>>
    | Map<LearningJourneyPartId, MissionProgress>
    | ReadonlyMap<LearningJourneyPartId, MissionProgress>,
  part: LearningJourneyPartId,
): MissionProgress {
  if (
    typeof (progressByPart as Map<LearningJourneyPartId, MissionProgress>).get ===
    "function"
  ) {
    return (
      (progressByPart as Map<LearningJourneyPartId, MissionProgress>).get(part) ?? {
        completed: 0,
        total: 0,
      }
    );
  }
  return (
    (progressByPart as Partial<Record<LearningJourneyPartId, MissionProgress>>)[
      part
    ] ?? { completed: 0, total: 0 }
  );
}

/**
 * Derive per-mission visual state from tutor enrollments + drill progress.
 * Unlock gate remains enrollment. Every active mission gets a Start/Continue
 * `ctaLabel`; only the lowest incomplete enrolled mission gets `isCurrent`
 * (View Details / ring emphasis).
 */
export function deriveMissionStates(
  enrolledParts: readonly number[],
  progressByPart:
    | Partial<Record<LearningJourneyPartId, MissionProgress>>
    | Map<LearningJourneyPartId, MissionProgress>
    | ReadonlyMap<LearningJourneyPartId, MissionProgress>,
): DerivedMissionState[] {
  const enrolled = new Set(
    enrolledParts.filter((p): p is LearningJourneyPartId =>
      isLearningJourneyPartId(p),
    ),
  );

  const states: DerivedMissionState[] = LEARNING_JOURNEY_PARTS.map((partDef) => {
    const progress = resolveProgress(progressByPart, partDef.part);
    const isEnrolled = enrolled.has(partDef.part);
    const isComplete =
      isEnrolled &&
      (progress.total === 0 || progress.completed >= progress.total);
    const percent =
      progress.total > 0
        ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
        : 0;

    let status: MissionVisualStatus;
    if (!isEnrolled) {
      status = "locked";
    } else if (isComplete) {
      status = "completed";
    } else {
      status = "active";
    }

    const displayPercent = isComplete ? 100 : percent;
    const ctaLabel: MissionCtaLabel | null =
      status === "active" ? (displayPercent === 0 ? "start" : "continue") : null;

    return {
      part: partDef.part,
      status,
      percent: displayPercent,
      isCurrent: false,
      ctaLabel,
      completed: progress.completed,
      total: progress.total,
      accent: isComplete ? MISSION_COMPLETED_ACCENT : partDef.accent,
      icon: partDef.icon,
    };
  });

  // Journey complete when every enrolled mission is done (unenrolled stay locked).
  // Trophy sits on the highest enrolled part, not always M5.
  const enrolledStates = states.filter((s) => s.status !== "locked");
  const allEnrolledComplete =
    enrolledStates.length >= 1 &&
    enrolledStates.every((s) => s.status === "completed");
  if (allEnrolledComplete) {
    const highest = enrolledStates.reduce((best, s) =>
      s.part > best.part ? s : best,
    );
    highest.status = "journeyComplete";
    highest.accent = MISSION_COMPLETED_ACCENT;
  }

  const current = states.find((s) => s.status === "active");
  if (current) {
    current.isCurrent = true;
  }

  return states;
}

/** View Details target: current active, else first enrolled, else null. */
export function getViewDetailsPart(
  states: readonly DerivedMissionState[],
): LearningJourneyPartId | null {
  const current = states.find((s) => s.isCurrent);
  if (current) return current.part;
  const enrolled = states.find(
    (s) =>
      s.status === "active" ||
      s.status === "completed" ||
      s.status === "journeyComplete",
  );
  return enrolled?.part ?? null;
}
