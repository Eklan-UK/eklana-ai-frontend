import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getTopicById,
  isKnownLearningJourneyTopicId,
  isLearningJourneyPartId,
  isValidPartTopicPair,
  parseLearningJourneyPartId,
} from "./learning-journey.catalog";

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
    assert.equal(getTopicById("grammar")?.part, 5);
    assert.equal(getTopicById("phone_colleagues")?.part, 5);
  });

  it("validates Mission 4 interview prep and Mission 5 bonus part/topic pairs", () => {
    assert.equal(isValidPartTopicPair(4, "mock_3"), true);
    assert.equal(isValidPartTopicPair(4, "motivation_prep"), true);
    assert.equal(isValidPartTopicPair(5, "mock_3"), false);
    assert.equal(isValidPartTopicPair(5, "grammar"), true);
    assert.equal(isValidPartTopicPair(5, "phone_colleagues"), true);
    assert.equal(isValidPartTopicPair(4, "grammar"), false);
    assert.equal(isValidPartTopicPair(4, "phone_colleagues"), false);
  });

  it("no longer recognizes interview_preparation as a known topic", () => {
    assert.equal(isKnownLearningJourneyTopicId("interview_preparation"), false);
    assert.equal(getTopicById("interview_preparation"), undefined);
    assert.equal(isValidPartTopicPair(4, "interview_preparation"), false);
  });
});
