import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeFillBlankItems } from "./drill";

describe("normalizeFillBlankItems", () => {
  it("passes through trimmed context when present", () => {
    const result = normalizeFillBlankItems([
      {
        context: "  You are handing over, so you say:  ",
        sentence: "The patient ___ stable.",
        blanks: [
          {
            position: 0,
            correctAnswer: "is",
            options: ["is", "are"],
          },
        ],
      },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].context, "You are handing over, so you say:");
    assert.equal(result[0].sentence, "The patient ___ stable.");
  });

  it("omits context when empty or whitespace only", () => {
    const result = normalizeFillBlankItems([
      {
        context: "   ",
        sentence: "She ___ to work.",
        blanks: [
          {
            position: 0,
            correctAnswer: "walks",
            options: ["walks", "runs"],
          },
        ],
      },
    ]);
    assert.equal(result.length, 1);
    assert.equal("context" in result[0], false);
  });
});
