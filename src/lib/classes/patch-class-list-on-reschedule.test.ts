import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdminClassListItemDTO } from "@/domain/classes/class.api.types";
import { patchClassListDataOnReschedule } from "./patch-class-list-on-reschedule";

const SERIES_ID = "series-1";
const OTHER_ID = "series-2";
const NEW_START = "2026-09-01T15:00:00.000Z";
const NEW_END = "2026-09-01T16:00:00.000Z";

const pagination = { total: 2, limit: 20, offset: 0, hasMore: false };

function classRow(
  id: string,
  extras: Partial<AdminClassListItemDTO> = {},
): AdminClassListItemDTO {
  return {
    id,
    studentLabel: "Student",
    extraStudents: 0,
    tutorName: "Tutor",
    tutorId: "tutor-1",
    classType: "individual",
    participants: [],
    scheduleDays: "Monday",
    timeRange: "10:00 AM – 11:00 AM",
    completedSessions: 0,
    programPosition: 1,
    totalSessions: 10,
    nextSessionLabel: "Mon, Jan 5, 2026",
    nextSessionStartUtc: "2026-01-05T15:00:00.000Z",
    nextSessionIsReschedule: false,
    status: "upcoming",
    bucket: "upcoming",
    ...extras,
  };
}

describe("patchClassListDataOnReschedule", () => {
  it("patches the matching series row on a flat { classes, pagination } list", () => {
    const old = {
      classes: [classRow(SERIES_ID), classRow(OTHER_ID)],
      pagination,
    };

    const next = patchClassListDataOnReschedule(old, SERIES_ID, NEW_START, NEW_END);

    const matched = next.classes.find((row) => row.id === SERIES_ID);
    assert.ok(matched);
    assert.equal(matched.nextSessionStartUtc, NEW_START);
    assert.equal(matched.nextSessionIsReschedule, true);
  });

  it("patches matching rows in infinite { pages } without throwing", () => {
    const old = {
      pages: [
        { classes: [classRow(SERIES_ID)], pagination },
        { classes: [classRow(OTHER_ID)], pagination },
      ],
      pageParams: [0, 20],
    };

    const next = patchClassListDataOnReschedule(old, SERIES_ID, NEW_START, NEW_END);

    const matched = next.pages[0]!.classes.find((row) => row.id === SERIES_ID);
    assert.ok(matched);
    assert.equal(matched.nextSessionStartUtc, NEW_START);
    assert.equal(matched.nextSessionIsReschedule, true);
    assert.equal(next.pageParams[1], 20);
  });

  it("leaves unrelated rows unchanged", () => {
    const other = classRow(OTHER_ID);
    const old = {
      classes: [classRow(SERIES_ID), other],
      pagination,
    };

    const next = patchClassListDataOnReschedule(old, SERIES_ID, NEW_START, NEW_END);
    const unmatched = next.classes.find((row) => row.id === OTHER_ID);

    assert.deepEqual(unmatched, other);
    assert.equal(unmatched?.nextSessionStartUtc, "2026-01-05T15:00:00.000Z");
    assert.equal(unmatched?.nextSessionIsReschedule, false);
  });

  it("is a no-op when classes is missing", () => {
    const old = { pagination };
    const next = patchClassListDataOnReschedule(old, SERIES_ID, NEW_START, NEW_END);
    assert.equal(next, old);

    const infiniteMissingClasses = {
      pages: [{ pagination }, { foo: 1 }],
      pageParams: [0],
    };
    const nextInfinite = patchClassListDataOnReschedule(
      infiniteMissingClasses,
      SERIES_ID,
      NEW_START,
      NEW_END,
    );
    assert.deepEqual(nextInfinite.pages, infiniteMissingClasses.pages);
  });
});
