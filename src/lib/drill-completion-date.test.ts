import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseDrillCompletionDateInput,
  formatDrillCompletionDateForInput,
  drillCompletionDateEnd,
  isDrillCompletionOverdue,
} from "./drill-completion-date";

describe("parseDrillCompletionDateInput", () => {
  it("parses YYYY-MM-DD as end of that local calendar day", () => {
    const d = parseDrillCompletionDateInput("2026-07-20");
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 6);
    assert.equal(d.getDate(), 20);
    assert.equal(d.getHours(), 23);
    assert.equal(d.getMinutes(), 59);
    assert.equal(d.getSeconds(), 59);
    assert.equal(d.getMilliseconds(), 999);
  });

  it("accepts Date values and snaps to end of local day", () => {
    const d = parseDrillCompletionDateInput(new Date(2026, 6, 20, 9, 30, 0));
    assert.equal(d.getDate(), 20);
    assert.equal(d.getHours(), 23);
    assert.equal(d.getMinutes(), 59);
  });

  it("throws on invalid input", () => {
    assert.throws(() => parseDrillCompletionDateInput("not-a-date"), {
      message: "Invalid completion date",
    });
  });
});

describe("formatDrillCompletionDateForInput", () => {
  it("round-trips parse → formatForInput to the same YYYY-MM-DD", () => {
    const input = "2026-07-20";
    const parsed = parseDrillCompletionDateInput(input);
    assert.equal(formatDrillCompletionDateForInput(parsed), input);
  });

  it("uses local civil date parts (not UTC ISO slice)", () => {
    // End of local Jul 20 — in western zones the UTC ISO date may be Jul 21
    const endOfDay = new Date(2026, 6, 20, 23, 59, 59, 999);
    assert.equal(formatDrillCompletionDateForInput(endOfDay), "2026-07-20");
  });
});

describe("drillCompletionDateEnd", () => {
  it("normalizes to 23:59:59.999 local", () => {
    const end = drillCompletionDateEnd(new Date(2026, 6, 20, 8, 0, 0));
    assert.equal(end.getHours(), 23);
    assert.equal(end.getMinutes(), 59);
    assert.equal(end.getSeconds(), 59);
    assert.equal(end.getMilliseconds(), 999);
    assert.equal(end.getDate(), 20);
  });
});

describe("isDrillCompletionOverdue", () => {
  let nowSpy: ReturnType<typeof mock.method> | undefined;

  beforeEach(() => {
    nowSpy = undefined;
  });

  afterEach(() => {
    nowSpy?.mock.restore();
  });

  it("is not overdue on the morning of the due day", () => {
    const due = parseDrillCompletionDateInput("2026-07-20");
    // Local morning of due day
    nowSpy = mock.method(Date, "now", () => new Date(2026, 6, 20, 9, 0, 0).getTime());
    assert.equal(isDrillCompletionOverdue(due), false);
  });

  it("is overdue after local end of the due day", () => {
    const due = parseDrillCompletionDateInput("2026-07-20");
    nowSpy = mock.method(Date, "now", () => new Date(2026, 6, 21, 0, 0, 1).getTime());
    assert.equal(isDrillCompletionOverdue(due), true);
  });

  it("returns false for null/undefined", () => {
    assert.equal(isDrillCompletionOverdue(null), false);
    assert.equal(isDrillCompletionOverdue(undefined), false);
  });
});
