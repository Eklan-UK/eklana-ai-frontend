import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_QUICK_ACTION_IDS,
  QUICK_ACTIONS_VISIBLE_CAP,
  sanitizeQuickActionIds,
} from "./quick-actions";

describe("sanitizeQuickActionIds", () => {
  it("returns Figma defaults for missing or invalid payloads", () => {
    assert.deepEqual(sanitizeQuickActionIds(undefined), DEFAULT_QUICK_ACTION_IDS);
    assert.deepEqual(sanitizeQuickActionIds({}), DEFAULT_QUICK_ACTION_IDS);
    assert.deepEqual(sanitizeQuickActionIds(["not-real"]), DEFAULT_QUICK_ACTION_IDS);
  });

  it("keeps known ids, drops unknowns, and caps at five", () => {
    const ids = sanitizeQuickActionIds([
      "learners",
      "unknown",
      "tutor",
      "learners",
      "classes",
      "subscriptions",
      "weekly-challenge",
      "bookmark-drills",
    ]);

    assert.deepEqual(ids, [
      "learners",
      "tutor",
      "classes",
      "subscriptions",
      "weekly-challenge",
    ]);
    assert.equal(ids.length, QUICK_ACTIONS_VISIBLE_CAP);
  });
});
