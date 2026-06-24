import { describe, expect, it } from "vitest";
import { mapAiPartTopicToJourney } from "./ai-journey-map";

describe("mapAiPartTopicToJourney", () => {
  it("maps Part 1 and topic title to catalog IDs", () => {
    const result = mapAiPartTopicToJourney(
      "Part 1: Communication with Patients",
      "Handling Emergency/Critical Situation",
    );
    expect(result.journeyPart).toBe(1);
    expect(result.journeyTopic).toBe("handling_emergency_critical");
  });

  it("returns empty when part does not match", () => {
    const result = mapAiPartTopicToJourney("Unknown Part", "Some Topic");
    expect(result.journeyPart).toBe("");
    expect(result.journeyTopic).toBe("");
  });
});
