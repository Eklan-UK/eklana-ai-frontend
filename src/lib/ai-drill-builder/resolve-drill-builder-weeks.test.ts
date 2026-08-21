import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import User from "@/models/user";
import DrillAssignment from "@/models/drill-assignment";
import {
  deleteStudentWeeks,
  remapDrillBuilderWeekDates,
  updateStudentWeekDates,
  upsertDrillBuilderWeekDateRow,
} from "./resolve-drill-builder-weeks";
import { formatDateForInput, parseLocalCalendarDate } from "./week-utils";

const LEARNER_ID = "507f1f77bcf86cd799439011";
const ANCHOR = new Date("2026-01-01T00:00:00.000Z");

function chainFind(result: unknown) {
  return {
    select: () => ({
      lean: () => ({
        exec: async () => result,
      }),
    }),
  };
}

function localRange(startYmd: string, endYmd: string) {
  const weekStartDate = parseLocalCalendarDate(startYmd, "start");
  const weekEndDate = parseLocalCalendarDate(endYmd, "end");
  assert.ok(weekStartDate);
  assert.ok(weekEndDate);
  return { weekStartDate, weekEndDate };
}

describe("upsertDrillBuilderWeekDateRow", () => {
  it("inserts a row when the week has no override yet", () => {
    const row = { weekNumber: 2, ...localRange("2026-08-14", "2026-08-20") };
    const next = upsertDrillBuilderWeekDateRow(
      [{ weekNumber: 1, ...localRange("2026-08-01", "2026-08-07") }],
      row,
    );

    assert.deepEqual(
      next.map((r) => r.weekNumber),
      [1, 2],
    );
    assert.equal(formatDateForInput(next[1]!.weekStartDate), "2026-08-14");
    assert.equal(formatDateForInput(next[1]!.weekEndDate), "2026-08-20");
  });

  it("replaces an existing week without changing other rows", () => {
    const existing = [
      { weekNumber: 1, ...localRange("2026-08-01", "2026-08-07") },
      { weekNumber: 2, ...localRange("2026-08-08", "2026-08-13") },
    ];
    const next = upsertDrillBuilderWeekDateRow(existing, {
      weekNumber: 2,
      ...localRange("2026-08-14", "2026-08-20"),
    });

    assert.equal(next.length, 2);
    assert.equal(formatDateForInput(next[0]!.weekStartDate), "2026-08-01");
    assert.equal(formatDateForInput(next[1]!.weekStartDate), "2026-08-14");
    assert.equal(formatDateForInput(next[1]!.weekEndDate), "2026-08-20");
  });
});

describe("remapDrillBuilderWeekDates", () => {
  it("drops deleted weeks and compact-remaps remaining week numbers", () => {
    const dates = [
      { weekNumber: 1, ...localRange("2026-08-01", "2026-08-07") },
      { weekNumber: 2, ...localRange("2026-08-08", "2026-08-13") },
      { weekNumber: 4, ...localRange("2026-08-21", "2026-08-27") },
    ];
    // Delete week 2: remaining 1,3,4 → 1,2,3. Week 3 had no override.
    const remap = new Map<number, number>([
      [1, 1],
      [3, 2],
      [4, 3],
    ]);

    const next = remapDrillBuilderWeekDates(dates, remap);

    assert.deepEqual(
      next.map((r) => r.weekNumber),
      [1, 3],
    );
    assert.equal(formatDateForInput(next[0]!.weekStartDate), "2026-08-01");
    assert.equal(formatDateForInput(next[1]!.weekStartDate), "2026-08-21");
    assert.equal(formatDateForInput(next[1]!.weekEndDate), "2026-08-27");
  });
});

describe("updateStudentWeekDates", () => {
  const originalFindById = User.findById.bind(User);
  const originalUpdateOne = User.updateOne.bind(User);
  const originalAssignmentFind = DrillAssignment.find.bind(DrillAssignment);

  let findById: ReturnType<typeof mock.fn>;
  let updateOne: ReturnType<typeof mock.fn>;
  let userDoc: {
    _id: string;
    createdAt: Date;
    subscriptionActivatedAt: Date;
    drillBuilderWeekCount: number;
    drillBuilderWeekDates: Array<{
      weekNumber: number;
      weekStartDate: Date;
      weekEndDate: Date;
    }>;
  };

  beforeEach(() => {
    userDoc = {
      _id: LEARNER_ID,
      createdAt: ANCHOR,
      subscriptionActivatedAt: ANCHOR,
      drillBuilderWeekCount: 3,
      drillBuilderWeekDates: [
        { weekNumber: 1, ...localRange("2026-08-01", "2026-08-07") },
      ],
    };

    findById = mock.fn(() => chainFind(userDoc));
    updateOne = mock.fn(() => ({
      exec: async () => ({ modifiedCount: 1 }),
    }));

    User.findById = findById as typeof User.findById;
    User.updateOne = updateOne as typeof User.updateOne;
    DrillAssignment.find = mock.fn(() =>
      chainFind([]),
    ) as typeof DrillAssignment.find;
  });

  afterEach(() => {
    User.findById = originalFindById;
    User.updateOne = originalUpdateOne;
    DrillAssignment.find = originalAssignmentFind;
  });

  it("upserts the edited week dates without writing assignment fields", async () => {
    const result = await updateStudentWeekDates({
      learnerId: LEARNER_ID,
      weekNumber: 2,
      weekStartDate: "2026-08-14",
      weekEndDate: "2026-08-20",
    });

    assert.equal(result.weekNumber, 2);
    assert.equal(formatDateForInput(result.weekStartDate), "2026-08-14");
    assert.equal(formatDateForInput(result.weekEndDate), "2026-08-20");
    assert.equal(result.weekStartDate.getHours(), 0);
    assert.equal(result.weekStartDate.getMinutes(), 0);
    assert.equal(result.weekEndDate.getHours(), 23);
    assert.equal(result.weekEndDate.getMinutes(), 59);

    assert.equal(updateOne.mock.calls.length, 1);
    const [, update] = updateOne.mock.calls[0]!.arguments as [
      unknown,
      { $set: { drillBuilderWeekDates: typeof userDoc.drillBuilderWeekDates } },
    ];
    const dates = update.$set.drillBuilderWeekDates;
    assert.deepEqual(
      dates.map((row) => row.weekNumber),
      [1, 2],
    );
    assert.equal(formatDateForInput(dates[0]!.weekStartDate), "2026-08-01");
    assert.equal(formatDateForInput(dates[1]!.weekStartDate), "2026-08-14");
    assert.equal("dueDate" in update.$set, false);
    assert.equal("assignedAt" in update.$set, false);
    assert.equal("builderWeekNumber" in update.$set, false);
  });

  it("replaces an existing override for the same week", async () => {
    userDoc.drillBuilderWeekDates.push({
      weekNumber: 2,
      ...localRange("2026-08-08", "2026-08-13"),
    });

    await updateStudentWeekDates({
      learnerId: LEARNER_ID,
      weekNumber: 2,
      weekStartDate: "2026-08-14",
      weekEndDate: "2026-08-20",
    });

    const [, update] = updateOne.mock.calls[0]!.arguments as [
      unknown,
      { $set: { drillBuilderWeekDates: typeof userDoc.drillBuilderWeekDates } },
    ];
    const dates = update.$set.drillBuilderWeekDates;
    assert.equal(dates.length, 2);
    assert.equal(formatDateForInput(dates[1]!.weekStartDate), "2026-08-14");
    assert.equal(formatDateForInput(dates[1]!.weekEndDate), "2026-08-20");
  });

  it("rejects a week that does not exist", async () => {
    await assert.rejects(
      () =>
        updateStudentWeekDates({
          learnerId: LEARNER_ID,
          weekNumber: 9,
          weekStartDate: "2026-08-14",
          weekEndDate: "2026-08-20",
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.name, "ValidationError");
        assert.match(err.message, /Week 9 does not exist/);
        return true;
      },
    );
    assert.equal(updateOne.mock.calls.length, 0);
  });

  it("rejects end before start without writing", async () => {
    await assert.rejects(
      () =>
        updateStudentWeekDates({
          learnerId: LEARNER_ID,
          weekNumber: 1,
          weekStartDate: "2026-08-20",
          weekEndDate: "2026-08-14",
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.name, "ValidationError");
        assert.match(err.message, /on or after weekStartDate/);
        return true;
      },
    );
    assert.equal(findById.mock.calls.length, 0);
    assert.equal(updateOne.mock.calls.length, 0);
  });
});

describe("deleteStudentWeeks remaps drillBuilderWeekDates", () => {
  const originalFindById = User.findById.bind(User);
  const originalUpdateOne = User.updateOne.bind(User);
  const originalAssignmentFind = DrillAssignment.find.bind(DrillAssignment);
  const originalBulkWrite = DrillAssignment.collection.bulkWrite.bind(
    DrillAssignment.collection,
  );

  let updateOne: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    const userDoc = {
      _id: LEARNER_ID,
      createdAt: ANCHOR,
      subscriptionActivatedAt: ANCHOR,
      drillBuilderWeekCount: 4,
      drillBuilderWeekDates: [
        { weekNumber: 1, ...localRange("2026-08-01", "2026-08-07") },
        { weekNumber: 2, ...localRange("2026-08-08", "2026-08-13") },
        { weekNumber: 4, ...localRange("2026-08-21", "2026-08-27") },
      ],
    };

    updateOne = mock.fn(() => ({
      exec: async () => ({ modifiedCount: 1 }),
    }));

    User.findById = mock.fn(() => chainFind(userDoc)) as typeof User.findById;
    User.updateOne = updateOne as typeof User.updateOne;
    DrillAssignment.find = mock.fn(() =>
      chainFind([]),
    ) as typeof DrillAssignment.find;
    DrillAssignment.collection.bulkWrite = mock.fn(async () => ({
      modifiedCount: 0,
    })) as typeof DrillAssignment.collection.bulkWrite;
  });

  afterEach(() => {
    User.findById = originalFindById;
    User.updateOne = originalUpdateOne;
    DrillAssignment.find = originalAssignmentFind;
    DrillAssignment.collection.bulkWrite = originalBulkWrite;
  });

  it("compacts remaining date overrides and drops rows for deleted weeks", async () => {
    await deleteStudentWeeks({
      learnerId: LEARNER_ID,
      weekNumbers: [2],
    });

    assert.equal(updateOne.mock.calls.length, 1);
    const [, update] = updateOne.mock.calls[0]!.arguments as [
      unknown,
      {
        $set: {
          drillBuilderWeekCount: number;
          drillBuilderWeekDates: Array<{
            weekNumber: number;
            weekStartDate: Date;
            weekEndDate: Date;
          }>;
        };
      },
    ];

    assert.equal(update.$set.drillBuilderWeekCount, 3);
    const dates = update.$set.drillBuilderWeekDates;
    assert.deepEqual(
      dates.map((row) => row.weekNumber),
      [1, 3],
    );
    assert.equal(formatDateForInput(dates[0]!.weekStartDate), "2026-08-01");
    assert.equal(formatDateForInput(dates[1]!.weekStartDate), "2026-08-21");
    assert.equal(formatDateForInput(dates[1]!.weekEndDate), "2026-08-27");
  });
});
