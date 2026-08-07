import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { triggerDrillEndConfetti } from "./drill-celebration";

describe("triggerDrillEndConfetti", () => {
  it("does not throw for the default pass variant outside a browser", () => {
    assert.doesNotThrow(() => triggerDrillEndConfetti());
  });

  it("does not throw for the perfect variant outside a browser", () => {
    assert.doesNotThrow(() => triggerDrillEndConfetti("perfect"));
  });

  it("no-ops when document is unavailable (server / test environment)", () => {
    assert.equal(typeof document, "undefined");
    assert.doesNotThrow(() => triggerDrillEndConfetti("pass"));
    assert.doesNotThrow(() => triggerDrillEndConfetti("perfect"));
  });
});
