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
  getSkillTransition,
  overallSkillBadgeLabel,
  skillBarTicks,
} from "./skill-bands";

describe("getSkillBand", () => {
  it("maps < 40 to Emerging Communicator with next Developing Communicator at 40", () => {
    const band = getSkillBand(35);
    assert.equal(band.id, "emerging");
    assert.equal(band.label, "Emerging Communicator");
    assert.equal(band.nextLabel, "Developing Communicator");
    assert.equal(band.nextThreshold, 40);
    assert.equal(band.pointsToNext, 5);
    assert.equal(band.prevLabel, null);
    assert.equal(band.pointsToPrev, 0);
  });

  it("maps < 60 to Developing Communicator with next Effective and prev Emerging", () => {
    const band = getSkillBand(52);
    assert.equal(band.id, "developing");
    assert.equal(band.nextLabel, "Effective Communicator");
    assert.equal(band.pointsToNext, 8);
    assert.equal(band.prevLabel, "Emerging Communicator");
    assert.equal(band.pointsToPrev, 13);
  });

  it("maps < 75 to Effective Communicator with next Confident and prev Developing", () => {
    const band = getSkillBand(68);
    assert.equal(band.id, "effective");
    assert.equal(band.nextLabel, "Confident Communicator");
    assert.equal(band.pointsToNext, 7);
    assert.equal(band.prevLabel, "Developing Communicator");
    assert.equal(band.pointsToPrev, 9);
  });

  it("maps < 90 to Confident Communicator with next Authoritative and prev Effective", () => {
    const band = getSkillBand(82);
    assert.equal(band.id, "confident");
    assert.equal(band.nextLabel, "Authoritative Communicator");
    assert.equal(band.pointsToNext, 8);
    assert.equal(band.prevLabel, "Effective Communicator");
    assert.equal(band.pointsToPrev, 8);
  });

  it("maps >= 90 to Authoritative Communicator with no next and prev Confident", () => {
    const band = getSkillBand(90);
    assert.equal(band.id, "authoritative");
    assert.equal(band.label, "Authoritative Communicator");
    assert.equal(band.nextLabel, null);
    assert.equal(band.pointsToNext, 0);
    assert.equal(band.prevLabel, "Confident Communicator");
    assert.equal(band.pointsToPrev, 1);
  });

  it("treats non-finite scores as 0", () => {
    assert.equal(getSkillBand(Number.NaN).id, "emerging");
  });
});

describe("getSkillTransition", () => {
  it("points up to the next communicator on increase", () => {
    assert.deepEqual(getSkillTransition(35, 0), {
      kind: "up",
      points: 5,
      label: "Developing Communicator",
    });
    assert.deepEqual(getSkillTransition(52, 4), {
      kind: "up",
      points: 8,
      label: "Effective Communicator",
    });
  });

  it("points down to the previous communicator when weekly change is declining", () => {
    assert.deepEqual(getSkillTransition(52, -3), {
      kind: "down",
      points: 13,
      label: "Emerging Communicator",
    });
    assert.deepEqual(getSkillTransition(52, -13), {
      kind: "down",
      points: 13,
      label: "Emerging Communicator",
    });
  });

  it("does not treat a small weekly dip as decline", () => {
    assert.deepEqual(getSkillTransition(52, -2), {
      kind: "up",
      points: 8,
      label: "Effective Communicator",
    });
  });

  it("still points up from Emerging when declining (no lower band)", () => {
    assert.deepEqual(getSkillTransition(35, -5), {
      kind: "up",
      points: 5,
      label: "Developing Communicator",
    });
  });

  it("shows max at Authoritative when not declining", () => {
    assert.deepEqual(getSkillTransition(90, 0), {
      kind: "max",
      points: 0,
      label: null,
    });
    assert.deepEqual(getSkillTransition(100, 2), {
      kind: "max",
      points: 0,
      label: null,
    });
  });

  it("points down from Authoritative when declining", () => {
    assert.deepEqual(getSkillTransition(92, -4), {
      kind: "down",
      points: 3,
      label: "Confident Communicator",
    });
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
