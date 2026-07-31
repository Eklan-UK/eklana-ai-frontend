import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveMissionStates,
  getTopicById,
  getViewDetailsPart,
  isKnownLearningJourneyTopicId,
  isLearningJourneyPartId,
  isValidPartTopicPair,
  MISSION_COMPLETED_ACCENT,
  MISSION_LOCKED_RAIL,
  parseLearningJourneyPartId,
  railSegmentColor,
  railSegmentFillRatio,
  type LearningJourneyPartId,
  type MissionProgress,
} from "./learning-journey.catalog";

function progressMap(
  entries: Partial<Record<LearningJourneyPartId, MissionProgress>>,
): Map<LearningJourneyPartId, MissionProgress> {
  const map = new Map<LearningJourneyPartId, MissionProgress>();
  for (const [key, value] of Object.entries(entries)) {
    if (value) map.set(Number(key) as LearningJourneyPartId, value);
  }
  return map;
}

describe("learning-journey.catalog", () => {
  it("accepts Mission 5 as a valid part id", () => {
    assert.equal(isLearningJourneyPartId(5), true);
    assert.equal(parseLearningJourneyPartId("5"), 5);
    assert.equal(parseLearningJourneyPartId(5), 5);
  });

  it("resolves Mission 4 interview prep topic titles", () => {
    assert.equal(getTopicById("motivation_prep")?.title, "Motivation prep");
    assert.equal(getTopicById("technical_prep")?.title, "Technical prep");
    assert.equal(
      getTopicById("situation_judgement_prep")?.title,
      "Situation Judgement Prep",
    );
    assert.equal(getTopicById("mock_3")?.title, "Mock 3");
    assert.equal(getTopicById("mock_5")?.part, 4);
  });

  it("resolves Mission 5 bonus topic titles", () => {
    assert.equal(getTopicById("grammar")?.title, "Grammar");
    assert.equal(
      getTopicById("phone_colleagues")?.title,
      "Phone Communication with Colleagues",
    );
    assert.equal(
      getTopicById("discharging_patients")?.title,
      "Discharging Patients",
    );
    assert.equal(getTopicById("grammar")?.part, 5);
    assert.equal(getTopicById("phone_colleagues")?.part, 5);
    assert.equal(getTopicById("discharging_patients")?.part, 5);
    assert.equal(getTopicById("discharging_patients")?.freeTalkScenarioType, "discharge");
    assert.equal(getTopicById("grammar")?.freeTalkScenarioType, "grammar");
  });

  it("validates Mission 4 interview prep and Mission 5 bonus part/topic pairs", () => {
    assert.equal(isValidPartTopicPair(4, "mock_3"), true);
    assert.equal(isValidPartTopicPair(4, "motivation_prep"), true);
    assert.equal(isValidPartTopicPair(5, "mock_3"), false);
    assert.equal(isValidPartTopicPair(5, "grammar"), true);
    assert.equal(isValidPartTopicPair(5, "phone_colleagues"), true);
    assert.equal(isValidPartTopicPair(5, "discharging_patients"), true);
    assert.equal(isValidPartTopicPair(4, "grammar"), false);
    assert.equal(isValidPartTopicPair(4, "phone_colleagues"), false);
    assert.equal(isValidPartTopicPair(4, "discharging_patients"), false);
  });

  it("no longer recognizes interview_preparation as a known topic", () => {
    assert.equal(isKnownLearningJourneyTopicId("interview_preparation"), false);
    assert.equal(getTopicById("interview_preparation"), undefined);
    assert.equal(isValidPartTopicPair(4, "interview_preparation"), false);
  });
});

describe("deriveMissionStates", () => {
  it("marks all missions locked when nothing is enrolled", () => {
    const states = deriveMissionStates([], progressMap({}));
    assert.equal(states.length, 5);
    assert.ok(states.every((s) => s.status === "locked"));
    assert.ok(states.every((s) => !s.isCurrent));
    assert.ok(states.every((s) => s.ctaLabel === null));
    assert.equal(getViewDetailsPart(states), null);
  });

  it("marks only the lowest incomplete enrolled mission as current", () => {
    const states = deriveMissionStates(
      [1, 2],
      progressMap({
        1: { completed: 2, total: 10 },
        2: { completed: 1, total: 5 },
      }),
    );
    assert.equal(states[0].status, "active");
    assert.equal(states[0].isCurrent, true);
    assert.equal(states[0].ctaLabel, "continue");
    assert.equal(states[0].percent, 20);
    assert.equal(states[1].status, "active");
    assert.equal(states[1].isCurrent, false);
    assert.equal(states[1].ctaLabel, "continue");
    assert.equal(states[2].status, "locked");
    assert.equal(getViewDetailsPart(states), 1);
  });

  it("sets Start ctaLabel for every unlocked mission at 0%", () => {
    const empty: MissionProgress = { completed: 0, total: 5 };
    const states = deriveMissionStates(
      [1, 2, 3, 4, 5],
      progressMap({
        1: empty,
        2: empty,
        3: empty,
        4: empty,
        5: empty,
      }),
    );
    assert.ok(states.every((s) => s.status === "active"));
    assert.ok(states.every((s) => s.percent === 0));
    assert.ok(states.every((s) => s.ctaLabel === "start"));
    assert.equal(states[0].isCurrent, true);
    assert.ok(states.slice(1).every((s) => !s.isCurrent));
    assert.equal(getViewDetailsPart(states), 1);
  });

  it("sets Continue on non-sequential active missions with locked gaps", () => {
    const states = deriveMissionStates(
      [2, 4],
      progressMap({
        2: { completed: 2, total: 8 },
        4: { completed: 1, total: 5 },
      }),
    );
    assert.equal(states[0].status, "locked");
    assert.equal(states[0].ctaLabel, null);
    assert.equal(states[1].status, "active");
    assert.equal(states[1].ctaLabel, "continue");
    assert.equal(states[1].isCurrent, true);
    assert.equal(states[2].status, "locked");
    assert.equal(states[2].ctaLabel, null);
    assert.equal(states[3].status, "active");
    assert.equal(states[3].ctaLabel, "continue");
    assert.equal(states[3].isCurrent, false);
    assert.equal(states[4].status, "locked");
    assert.equal(getViewDetailsPart(states), 2);
  });

  it("advances current to next enrolled after completion", () => {
    const states = deriveMissionStates(
      [1, 2],
      progressMap({
        1: { completed: 10, total: 10 },
        2: { completed: 3, total: 8 },
      }),
    );
    assert.equal(states[0].status, "completed");
    assert.equal(states[0].isCurrent, false);
    assert.equal(states[0].ctaLabel, null);
    assert.equal(states[0].percent, 100);
    assert.equal(states[1].status, "active");
    assert.equal(states[1].isCurrent, true);
    assert.equal(states[1].ctaLabel, "continue");
    assert.equal(getViewDetailsPart(states), 2);
  });

  it("treats enrolled mission with no drills (total 0) as active at 0%", () => {
    const states = deriveMissionStates(
      [1],
      progressMap({ 1: { completed: 0, total: 0 } }),
    );
    assert.equal(states[0].status, "active");
    assert.equal(states[0].percent, 0);
    assert.equal(states[0].ctaLabel, "start");
    assert.equal(states[0].isCurrent, true);
    assert.ok(states.slice(1).every((s) => s.status === "locked"));
    assert.ok(states.every((s) => s.status !== "journeyComplete"));
  });

  it("keeps no-drill enrolled missions active without journeyComplete", () => {
    const empty: MissionProgress = { completed: 0, total: 0 };
    const states = deriveMissionStates(
      [1, 2],
      progressMap({ 1: empty, 2: empty }),
    );
    assert.equal(states[0].status, "active");
    assert.equal(states[0].percent, 0);
    assert.equal(states[0].ctaLabel, "start");
    assert.equal(states[0].isCurrent, true);
    assert.equal(states[1].status, "active");
    assert.equal(states[1].percent, 0);
    assert.equal(states[1].ctaLabel, "start");
    assert.equal(states[1].isCurrent, false);
    assert.ok(states.slice(2).every((s) => s.status === "locked"));
    assert.ok(states.every((s) => s.status !== "journeyComplete"));
  });

  it("sets M5 to journeyComplete when all five missions are done", () => {
    const full: MissionProgress = { completed: 1, total: 1 };
    const states = deriveMissionStates(
      [1, 2, 3, 4, 5],
      progressMap({ 1: full, 2: full, 3: full, 4: full, 5: full }),
    );
    assert.ok(
      states.slice(0, 4).every((s) => s.status === "completed"),
    );
    assert.equal(states[4].status, "journeyComplete");
    assert.ok(states.every((s) => !s.isCurrent));
    assert.equal(getViewDetailsPart(states), 1);
  });

  it("sets journeyComplete on highest enrolled when only M1–M2 are assigned and done", () => {
    const full: MissionProgress = { completed: 1, total: 1 };
    const states = deriveMissionStates(
      [1, 2],
      progressMap({ 1: full, 2: full }),
    );
    assert.equal(states[0].status, "completed");
    assert.equal(states[1].status, "journeyComplete");
    assert.equal(states[2].status, "locked");
    assert.equal(states[3].status, "locked");
    assert.equal(states[4].status, "locked");
    assert.ok(states.every((s) => !s.isCurrent));
    assert.equal(getViewDetailsPart(states), 1);
  });

  it("sets journeyComplete on sole enrolled mission when it is complete", () => {
    const states = deriveMissionStates(
      [1],
      progressMap({ 1: { completed: 5, total: 5 } }),
    );
    assert.equal(states[0].status, "journeyComplete");
    assert.ok(states.slice(1).every((s) => s.status === "locked"));
    assert.ok(states.every((s) => !s.isCurrent));
  });

  it("does not set journeyComplete when an enrolled mission is still incomplete", () => {
    const states = deriveMissionStates(
      [1, 2],
      progressMap({
        1: { completed: 10, total: 10 },
        2: { completed: 1, total: 5 },
      }),
    );
    assert.equal(states[0].status, "completed");
    assert.equal(states[1].status, "active");
    assert.equal(states[1].isCurrent, true);
    assert.ok(states.every((s) => s.status !== "journeyComplete"));
  });

  it("includes mission theme accents and icons", () => {
    const states = deriveMissionStates(
      [1],
      progressMap({ 1: { completed: 1, total: 5 } }),
    );
    assert.equal(states[0].accent, "#3b82f6");
    assert.equal(states[0].ctaLabel, "continue");
    assert.equal(states[0].icon, "stethoscope");
    assert.equal(states[1].icon, "users");
    assert.equal(states[4].icon, "star");
  });
});

describe("railSegmentColor", () => {
  it("returns green for completed and journeyComplete", () => {
    assert.equal(railSegmentColor("completed", "#3b82f6"), MISSION_COMPLETED_ACCENT);
    assert.equal(
      railSegmentColor("journeyComplete", "#ff7a00"),
      MISSION_COMPLETED_ACCENT,
    );
  });

  it("returns mission accent for active and gray for locked", () => {
    assert.equal(railSegmentColor("active", "#a855f7"), "#a855f7");
    assert.equal(railSegmentColor("locked", "#3b82f6"), MISSION_LOCKED_RAIL);
  });
});

describe("railSegmentFillRatio", () => {
  it("is full only when completed; active uses percent; locked is 0", () => {
    assert.equal(railSegmentFillRatio("completed", 40), 1);
    assert.equal(railSegmentFillRatio("journeyComplete", 0), 1);
    assert.equal(railSegmentFillRatio("active", 22), 0.22);
    assert.equal(railSegmentFillRatio("active", 50), 0.5);
    assert.equal(railSegmentFillRatio("active", 0), 0);
    assert.equal(railSegmentFillRatio("locked", 100), 0);
  });
});
