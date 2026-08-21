/**
 * Run: node --import tsx --test src/domain/progress/skill-bands.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  averageSkillScore,
  formatTimePracticed,
  getOverallSkillBadge,
  getSkillBand,
  overallSkillBadgeLabel,
  skillBarTicks,
} from "./skill-bands";

describe("getSkillBand", () => {
  it("maps < 40 to Emerging Communicator with next Learner at 40", () => {
    const band = getSkillBand(35);
    assert.equal(band.id, "emerging");
    assert.equal(band.label, "Emerging Communicator");
    assert.equal(band.nextLabel, "Learner");
    assert.equal(band.nextThreshold, 40);
    assert.equal(band.pointsToNext, 5);
  });

  it("maps < 60 to Developing Communicator with next Skilled at 60", () => {
    const band = getSkillBand(52);
    assert.equal(band.id, "developing");
    assert.equal(band.nextLabel, "Skilled");
    assert.equal(band.pointsToNext, 8);
  });

  it("maps < 75 to Effective Communicator with next Advanced at 75", () => {
    const band = getSkillBand(68);
    assert.equal(band.id, "effective");
    assert.equal(band.nextLabel, "Advanced");
    assert.equal(band.pointsToNext, 7);
  });

  it("maps < 90 to Confident Communicator with next Mastery at 90", () => {
    const band = getSkillBand(82);
    assert.equal(band.id, "confident");
    assert.equal(band.nextLabel, "Mastery");
    assert.equal(band.pointsToNext, 8);
  });

  it("maps >= 90 to Authoritative Communicator with no next", () => {
    const band = getSkillBand(90);
    assert.equal(band.id, "authoritative");
    assert.equal(band.label, "Authoritative Communicator");
    assert.equal(band.nextLabel, null);
    assert.equal(band.pointsToNext, 0);
  });

  it("treats non-finite scores as 0", () => {
    assert.equal(getSkillBand(Number.NaN).id, "emerging");
  });
});

describe("getOverallSkillBadge", () => {
  it("uses Figma overall thresholds", () => {
    assert.equal(getOverallSkillBadge(39), "learner");
    assert.equal(getOverallSkillBadge(40), "skilled");
    assert.equal(getOverallSkillBadge(65), "skilled");
    assert.equal(getOverallSkillBadge(74.9), "skilled");
    assert.equal(getOverallSkillBadge(75), "advanced");
    assert.equal(getOverallSkillBadge(89), "advanced");
    assert.equal(getOverallSkillBadge(90), "mastery");
  });

  it("labels overall badges", () => {
    assert.equal(overallSkillBadgeLabel("skilled"), "Skilled");
  });
});

describe("skillBarTicks", () => {
  it("fills round(score / 10) of 10 ticks", () => {
    assert.equal(skillBarTicks(35), 4);
    assert.equal(skillBarTicks(52), 5);
    assert.equal(skillBarTicks(68), 7);
    assert.equal(skillBarTicks(82), 8);
    assert.equal(skillBarTicks(0), 0);
    assert.equal(skillBarTicks(100), 10);
  });
});

describe("averageSkillScore", () => {
  it("averages the four scorecard metrics", () => {
    assert.equal(
      averageSkillScore({
        pronunciation: 52,
        accuracy: 68,
        fluency: 82,
        confidence: 35,
      }),
      (52 + 68 + 82 + 35) / 4
    );
  });
});

describe("formatTimePracticed", () => {
  it("formats seconds as minutes and hours", () => {
    assert.equal(formatTimePracticed(0), "0m");
    assert.equal(formatTimePracticed(30), "<1m");
    assert.equal(formatTimePracticed(120), "2m");
    assert.equal(formatTimePracticed(3600), "1h");
    assert.equal(formatTimePracticed(3900), "1h 5m");
  });
});
