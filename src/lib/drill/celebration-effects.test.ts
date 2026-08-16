import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDrillCompletionEffects,
  resolveDrillPassed,
  supportsPerfectCelebration,
} from "./celebration-effects";
import {
  DEFAULT_CELEBRATION_SOUND_URL,
  DEFAULT_PERFECT_CELEBRATION_SOUND_URL,
} from "./celebration-sound-url";

describe("supportsPerfectCelebration", () => {
  it("returns true for speech drill types", () => {
    for (const type of [
      "vocabulary",
      "pronunciation",
      "grammar",
      "roleplay",
      "key_phrases",
    ]) {
      assert.equal(supportsPerfectCelebration(type), true);
    }
  });

  it("returns false for non-speech and unknown types", () => {
    for (const type of [
      "matching",
      "listening",
      "fill_blank",
      "definition",
      "summary",
      "sentence",
      "sentence_writing",
      "unknown",
    ]) {
      assert.equal(supportsPerfectCelebration(type), false);
    }
  });

  it("returns false when drill type is missing", () => {
    assert.equal(supportsPerfectCelebration(undefined), false);
    assert.equal(supportsPerfectCelebration(null), false);
    assert.equal(supportsPerfectCelebration(""), false);
  });
});

describe("buildDrillCompletionEffects", () => {
  it("returns null when not passed", () => {
    assert.equal(buildDrillCompletionEffects(false, 100, "vocabulary"), null);
  });

  it("defaults to the pass confetti variant when no score is provided", () => {
    const effects = buildDrillCompletionEffects(true, undefined, "vocabulary");
    assert.equal(effects?.triggerConfetti, true);
    assert.equal(effects?.confettiVariant, "pass");
  });

  it("uses the pass confetti variant below a perfect score", () => {
    const effects = buildDrillCompletionEffects(true, 92, "vocabulary");
    assert.equal(effects?.confettiVariant, "pass");
  });

  it("uses the perfect confetti variant at exactly 100 for speech drills", () => {
    const effects = buildDrillCompletionEffects(true, 100, "vocabulary");
    assert.equal(effects?.confettiVariant, "perfect");
  });

  it("uses the perfect confetti variant when the score rounds up to 100 for speech drills", () => {
    const effects = buildDrillCompletionEffects(true, 99.6, "pronunciation");
    assert.equal(effects?.confettiVariant, "perfect");
  });

  it("does not treat a rounded-down 99 as perfect", () => {
    const effects = buildDrillCompletionEffects(true, 99.4, "vocabulary");
    assert.equal(effects?.confettiVariant, "pass");
  });

  it("keeps pass-only effects for non-speech drills even at 100", () => {
    for (const type of ["matching", "listening", "fill_blank", "definition"]) {
      const effects = buildDrillCompletionEffects(true, 100, type);
      assert.equal(effects?.confettiVariant, "pass", type);
      assert.equal(effects?.soundUrl, DEFAULT_CELEBRATION_SOUND_URL, type);
    }
  });

  it("keeps pass-only effects when drill type is missing even at 100", () => {
    const effects = buildDrillCompletionEffects(true, 100);
    assert.equal(effects?.confettiVariant, "pass");
    assert.equal(effects?.soundUrl, DEFAULT_CELEBRATION_SOUND_URL);
  });

  it("uses the normal celebration sound below a perfect score", () => {
    const effects = buildDrillCompletionEffects(true, 92, "vocabulary");
    assert.equal(effects?.soundUrl, DEFAULT_CELEBRATION_SOUND_URL);
  });

  it("uses the perfect celebration sound at exactly 100 for speech drills", () => {
    const effects = buildDrillCompletionEffects(true, 100, "key_phrases");
    assert.equal(effects?.soundUrl, DEFAULT_PERFECT_CELEBRATION_SOUND_URL);
  });

  it("uses the perfect celebration sound when the score rounds up to 100 for speech drills", () => {
    const effects = buildDrillCompletionEffects(true, 99.6, "roleplay");
    assert.equal(effects?.soundUrl, DEFAULT_PERFECT_CELEBRATION_SOUND_URL);
  });

  it("uses the normal celebration sound when no score is provided", () => {
    const effects = buildDrillCompletionEffects(true, undefined, "vocabulary");
    assert.equal(effects?.soundUrl, DEFAULT_CELEBRATION_SOUND_URL);
  });

  it("allows perfect for grammar at 100 (API consistency; UI may still skip celebration)", () => {
    const effects = buildDrillCompletionEffects(true, 100, "grammar");
    assert.equal(effects?.confettiVariant, "perfect");
    assert.equal(effects?.soundUrl, DEFAULT_PERFECT_CELEBRATION_SOUND_URL);
  });
});

describe("resolveDrillPassed", () => {
  it("passes when score meets the default threshold", () => {
    assert.equal(resolveDrillPassed(70, {}), true);
    assert.equal(resolveDrillPassed(69, {}), false);
  });

  it("passes summary drills regardless of score", () => {
    assert.equal(
      resolveDrillPassed(0, { summaryResults: { summaryProvided: true } }),
      true,
    );
  });

  it("passes listening drills regardless of score", () => {
    assert.equal(
      resolveDrillPassed(0, { listeningResults: { completed: true } }),
      true,
    );
  });
});
