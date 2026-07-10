import { describe, expect, it } from "vitest";
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
    expect(result).toHaveLength(1);
    expect(result[0].context).toBe("You are handing over, so you say:");
    expect(result[0].sentence).toBe("The patient ___ stable.");
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
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("context");
  });
});
