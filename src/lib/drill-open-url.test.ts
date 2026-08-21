import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDrillAppDeepLink,
  buildDrillOpenUrl,
  buildDrillWebPath,
  buildLearnerDrillHref,
  assignmentIdFromGetDrillPayload,
  bookmarkOpenPathAfterGet,
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

  it("omits assignmentId for bookmark-style opens", () => {
    assert.equal(buildDrillAppDeepLink("abc"), "elkan://account/drills/abc");
  });
});

describe("buildDrillWebPath", () => {
  it("builds account drill path with assignmentId", () => {
    assert.equal(
      buildDrillWebPath("abc", "xyz"),
      "/account/drills/abc?assignmentId=xyz",
    );
  });

  it("omits assignmentId query when not provided", () => {
    assert.equal(buildDrillWebPath("abc"), "/account/drills/abc");
  });

  it("bookmark OPEN includes recovered assignmentId", () => {
    const recovered = assignmentIdFromGetDrillPayload({
      code: "Success",
      data: {
        drill: { _id: "abc" },
        assignment: { assignmentId: "xyz" },
      },
    });
    assert.equal(recovered, "xyz");
    assert.equal(
      buildDrillWebPath("abc", recovered),
      "/account/drills/abc?assignmentId=xyz",
    );
    assert.equal(
      bookmarkOpenPathAfterGet("abc", true, {
        data: { assignment: { assignmentId: "xyz" } },
      }),
      "/account/drills/abc?assignmentId=xyz",
    );
  });
});

describe("assignmentIdFromGetDrillPayload", () => {
  it("reads assignmentId from GET /drills/:id envelope", () => {
    assert.equal(
      assignmentIdFromGetDrillPayload({
        data: { assignment: { assignmentId: "assign456" } },
      }),
      "assign456",
    );
  });

  it("reads assignmentId from unwrapped { drill, assignment }", () => {
    assert.equal(
      assignmentIdFromGetDrillPayload({
        assignment: { assignmentId: "assign456" },
      }),
      "assign456",
    );
  });

  it("returns undefined when GET has no assignment (stay / toast)", () => {
    assert.equal(
      assignmentIdFromGetDrillPayload({ data: { drill: { _id: "abc" } } }),
      undefined,
    );
    assert.equal(assignmentIdFromGetDrillPayload(null), undefined);
    assert.equal(
      assignmentIdFromGetDrillPayload({
        data: { assignment: { assignmentId: "" } },
      }),
      undefined,
    );
  });
});

describe("bookmarkOpenPathAfterGet", () => {
  it("returns null on 403 or missing assignment so the UI stays put", () => {
    assert.equal(
      bookmarkOpenPathAfterGet("abc", false, {
        data: { assignment: { assignmentId: "xyz" } },
      }),
      null,
    );
    assert.equal(
      bookmarkOpenPathAfterGet("abc", true, { data: { drill: { _id: "abc" } } }),
      null,
    );
  });
});

describe("buildLearnerDrillHref", () => {
  it("sends open Path rows to the player with assignmentId", () => {
    assert.equal(
      buildLearnerDrillHref("drill123", "assign456"),
      "/account/drills/drill123?assignmentId=assign456",
    );
  });

  it("sends completed Path rows to View Results with assignmentId", () => {
    assert.equal(
      buildLearnerDrillHref("drill123", "assign456", { completed: true }),
      "/account/drills/drill123/completed?assignmentId=assign456",
    );
  });

  it("omits assignmentId for drillId-only URLs (page still recovers)", () => {
    assert.equal(buildLearnerDrillHref("drill123"), "/account/drills/drill123");
    assert.equal(
      buildLearnerDrillHref("drill123", undefined, { completed: true }),
      "/account/drills/drill123",
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
