import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDrillAppDeepLink,
  buildDrillOpenUrl,
  buildDrillWebPath,
  isMobileUserAgent,
} from "./drill-open-url";

describe("buildDrillOpenUrl", () => {
  it("returns bounce URL when both IDs are present", () => {
    const url = buildDrillOpenUrl(
      "https://app.eklan.ai",
      "drill123",
      "assign456",
    );
    assert.equal(
      url,
      "https://app.eklan.ai/open/drill?drillId=drill123&assignmentId=assign456",
    );
  });

  it("falls back to drill list when IDs are missing", () => {
    assert.equal(
      buildDrillOpenUrl("https://app.eklan.ai/", "drill123"),
      "https://app.eklan.ai/account/drills",
    );
    assert.equal(
      buildDrillOpenUrl("https://app.eklan.ai"),
      "https://app.eklan.ai/account/drills",
    );
  });
});

describe("buildDrillAppDeepLink", () => {
  it("includes assignmentId query when provided", () => {
    assert.equal(
      buildDrillAppDeepLink("abc", "xyz"),
      "elkan://account/drills/abc?assignmentId=xyz",
    );
  });
});

describe("buildDrillWebPath", () => {
  it("builds account drill path with assignmentId", () => {
    assert.equal(
      buildDrillWebPath("abc", "xyz"),
      "/account/drills/abc?assignmentId=xyz",
    );
  });
});

describe("isMobileUserAgent", () => {
  it("detects mobile user agents", () => {
    assert.equal(
      isMobileUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
      true,
    );
    assert.equal(
      isMobileUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      ),
      false,
    );
  });
});
