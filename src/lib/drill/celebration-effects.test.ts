import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDrillCompletionEffects, resolveDrillPassed } from "./celebration-effects";

describe("buildDrillCompletionEffects", () => {
  it("returns null when not passed", () => {
    assert.equal(buildDrillCompletionEffects(false, 100), null);
  });

  it("defaults to the pass confetti variant when no score is provided", () => {
    const effects = buildDrillCompletionEffects(true);
    assert.equal(effects?.triggerConfetti, true);
    assert.equal(effects?.confettiVariant, "pass");
  });

  it("uses the pass confetti variant below a perfect score", () => {
    const effects = buildDrillCompletionEffects(true, 92);
    assert.equal(effects?.confettiVariant, "pass");
  });

  it("uses the perfect confetti variant at exactly 100", () => {
    const effects = buildDrillCompletionEffects(true, 100);
    assert.equal(effects?.confettiVariant, "perfect");
  });

  it("uses the perfect confetti variant when the score rounds up to 100", () => {
    const effects = buildDrillCompletionEffects(true, 99.6);
    assert.equal(effects?.confettiVariant, "perfect");
  });

  it("does not treat a rounded-down 99 as perfect", () => {
    const effects = buildDrillCompletionEffects(true, 99.4);
    assert.equal(effects?.confettiVariant, "pass");
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
