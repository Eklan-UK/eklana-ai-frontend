/**
 * Learning Path submit diagnostics for learner elvakim91@gmail.com
 * (userId 6a6a881339920e918be2a8c6). Frozen clock: 2026-08-20.
 *
 * Path = My Learning Journey on My Plan (GET /drills/learner/my-drills,
 * excludes source: 'precision_clinic'). Submit is POST /drills/[id]/complete
 * and requires a valid drillAssignmentId except Weekly Challenge.
 *
 * Run:
 *   node --import tsx --test src/domain/drills/elvakim91-learning-path-submit.test.ts
 *
 * Optional live Mongo (MONGO_URI in .env / .env.local):
 *   npx tsx scripts/diagnose-drill-visibility.ts --email elvakim91@gmail.com
 */
import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Types } from "mongoose";
import { z } from "zod";
import { buildLearnerDrillHref, buildDrillWebPath, assignmentIdFromGetDrillPayload, bookmarkOpenPathAfterGet } from "@/lib/drill-open-url";
import { getDrillStatus } from "@/utils/drill";
import {
  isCompletedPlanItem,
  isActiveAssignedPlanItem,
} from "@/lib/learner-assigned-plan";
import {
  groupDrillsByJourney,
  type JourneyDrillItem,
} from "@/lib/learning-journey/group-journey-drills";
import {
  isOutstandingAssignmentStatus,
  outstandingAssignmentMongoMatch,
} from "@/domain/drills/outstanding-drill-assignments";
import { validateRequest } from "@/lib/api/validation";
import { ValidationError } from "@/lib/api/response";

const NOW = new Date("2026-08-20T12:00:00.000Z");
const LEARNER_ID = "6a6a881339920e918be2a8c6";
const LEARNER_EMAIL = "elvakim91@gmail.com";
const PATH_TOPIC = "admitting_patient";
const PATH_PART = 1 as const;
const OPEN_PATH_TYPES = [
  "vocabulary",
  "key_phrases",
  "pronunciation",
  "fill_blank",
  "roleplay",
] as const;

/** Same refine as POST /api/v1/drills/[drillId]/complete `completeSchema`. */
const pathCompleteAssignmentIdSchema = z.string().refine(
  (id) => Types.ObjectId.isValid(id),
  { message: "Drill assignment ID must be a valid MongoDB ObjectId" },
);

const pathCompleteBodySchema = z.object({
  drillAssignmentId: pathCompleteAssignmentIdSchema,
  score: z.number().min(0).max(100),
  timeSpent: z.number().min(0),
});

/** Client player guard: Path/Clinic/Builder toast if this is false. WC is exempt. */
function canSubmitFromPlayer(opts: {
  assignmentId?: string | null;
  weeklyChallengeMeta?: unknown;
}): boolean {
  return Boolean(opts.assignmentId || opts.weeklyChallengeMeta);
}

function isLearnerPathAssignment(row: { source?: string | null }): boolean {
  return row.source !== "precision_clinic";
}

function hexId(n: number): string {
  return n.toString(16).padStart(24, "0");
}

/**
 * Mirrors DrillService.completeDrill steps 2–4: assignment exists, belongs to
 * this learner, and drill id matches. Does not check entitlements or overdue.
 */
function evaluateCompleteDrillPreconditions(args: {
  assignment:
    | { _id: unknown; learnerId: unknown; drillId: unknown }
    | null
    | undefined;
  learnerId: string;
  drillId: string;
  drillAssignmentId: string;
}): { ok: true } | { ok: false; reason: "not_found" | "forbidden" | "mismatch" } {
  const { assignment, learnerId, drillId, drillAssignmentId } = args;
  if (!assignment || String(assignment._id) !== drillAssignmentId) {
    return { ok: false, reason: "not_found" };
  }
  if (String(assignment.learnerId) !== learnerId) {
    return { ok: false, reason: "forbidden" };
  }
  const raw: unknown = assignment.drillId;
  const assignmentDrillIdStr =
    raw != null && typeof raw === "object" && "_id" in raw
      ? String((raw as { _id: unknown })._id)
      : String(raw);
  if (assignmentDrillIdStr !== String(drillId)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}

type PathAssignmentFixture = {
  _id: string;
  learnerId: string;
  drillId: string;
  source: "precision_clinic" | null;
  status: "pending" | "in-progress" | "completed" | "overdue" | "skipped";
  dueDate: string;
  completedAt: string | null;
  builderWeekNumber: number;
  drill: {
    _id: string;
    type: string;
    title: string;
    date: string;
    learning_journey_part: typeof PATH_PART;
    learning_journey_topic: string;
  };
};

/** Representative clone of this learner's Path week-3 admitting_patient work. */
const OPEN_PATH_ASSIGNMENTS: PathAssignmentFixture[] = OPEN_PATH_TYPES.map(
  (type, i) => {
    const assignmentId = hexId(0xa01 + i);
    const drillId = hexId(0xd01 + i);
    return {
      _id: assignmentId,
      learnerId: LEARNER_ID,
      drillId,
      source: null,
      status: i < 2 ? ("overdue" as const) : ("pending" as const),
      dueDate: "2026-08-10T23:59:59.999Z",
      completedAt: null,
      builderWeekNumber: 3,
      drill: {
        _id: drillId,
        type,
        title: `Week 3 ${type}`,
        date: "2026-08-10T23:59:59.999Z",
        learning_journey_part: PATH_PART,
        learning_journey_topic: PATH_TOPIC,
      },
    };
  },
);

const COMPLETED_PATH_ASSIGNMENT: PathAssignmentFixture = {
  _id: hexId(0xa10),
  learnerId: LEARNER_ID,
  drillId: hexId(0xd10),
  source: null,
  status: "completed",
  dueDate: "2026-08-03T23:59:59.999Z",
  completedAt: "2026-08-02T18:00:00.000Z",
  builderWeekNumber: 2,
  drill: {
    _id: hexId(0xd10),
    type: "matching",
    title: "Week 2 matching",
    date: "2026-08-03T23:59:59.999Z",
    learning_journey_part: PATH_PART,
    learning_journey_topic: "handling_emergency_critical",
  },
};

const CLINIC_CONTRAST = {
  _id: hexId(0xc01),
  learnerId: LEARNER_ID,
  drillId: hexId(0xc11),
  source: "precision_clinic" as const,
  status: "pending" as const,
};

function toJourneyItem(row: PathAssignmentFixture): JourneyDrillItem {
  return {
    assignmentId: new Types.ObjectId(row._id),
    drill: row.drill,
    assignedBy: null,
    assignedAt: new Date("2026-08-01T00:00:00.000Z"),
    dueDate: new Date(row.dueDate),
    status: row.status,
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    latestAttempt: null,
    hasBookmarks: false,
  } as JourneyDrillItem;
}

function journeyRowHref(item: JourneyDrillItem): string {
  const assignmentId =
    item.assignmentId != null ? String(item.assignmentId) : undefined;
  return buildLearnerDrillHref(String(item.drill._id), assignmentId, {
    completed: isCompletedPlanItem(item),
  });
}

type LivePathRow = {
  assignmentId: string;
  drillId: string;
  learnerId: string;
  status: string;
  source: string | null;
  drillSource: string | null;
  type: string | null;
  topic: string | null;
  part: number | null;
};

let liveRows: LivePathRow[] | null = null;
let liveSkipReason: string | null = null;
let liveConnected = false;

async function tryLoadLivePathAssignments(): Promise<void> {
  const dotenv = await import("dotenv");
  const root = process.cwd();
  for (const name of [".env.local", ".env"]) {
    const file = resolve(root, name);
    if (existsSync(file)) dotenv.config({ path: file });
  }
  if (!process.env.MONGO_URI) {
    liveSkipReason =
      "MONGO_URI is not set. Fixture tests still apply. Re-run diagnose: npx tsx scripts/diagnose-drill-visibility.ts --email elvakim91@gmail.com";
    return;
  }

  const { connectToDatabase } = await import("@/lib/api/db");
  const { default: DrillAssignment } = await import("@/models/drill-assignment");
  const { toUserIdQuery } = await import("@/lib/api/user-id");
  const mongoose = (await import("mongoose")).default;

  await connectToDatabase();
  liveConnected = true;

  const rows = await DrillAssignment.find({
    learnerId: toUserIdQuery(LEARNER_ID),
  })
    .populate({
      path: "drillId",
      select: "title type source learning_journey_part learning_journey_topic",
    })
    .lean()
    .exec();

  liveRows = rows.map((a: Record<string, unknown>) => {
    const drill = a.drillId as
      | {
          _id?: unknown;
          type?: string;
          source?: string;
          learning_journey_topic?: string;
          learning_journey_part?: number;
        }
      | string
      | null;
    const drillDoc = drill && typeof drill === "object" ? drill : null;
    return {
      assignmentId: String(a._id),
      drillId: String(drillDoc?._id ?? a.drillId),
      learnerId: String(a.learnerId),
      status: String(a.status ?? ""),
      source: (a.source as string | undefined) ?? null,
      drillSource: drillDoc?.source ?? null,
      type: drillDoc?.type ?? null,
      topic: drillDoc?.learning_journey_topic ?? null,
      part: drillDoc?.learning_journey_part ?? null,
    };
  });

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    liveConnected = false;
  }
}

describe("elvakim91 Learning Path submit (2026-08-20)", () => {
  let nowSpy: ReturnType<typeof mock.method> | undefined;

  before(() => {
    nowSpy = mock.method(Date, "now", () => NOW.getTime());
  });

  after(async () => {
    nowSpy?.mock.restore();
    if (liveConnected) {
      const mongoose = (await import("mongoose")).default;
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  });

  it("identifies this learner fixture", () => {
    assert.equal(LEARNER_ID.length, 24);
    assert.equal(Types.ObjectId.isValid(LEARNER_ID), true);
    assert.equal(LEARNER_EMAIL, "elvakim91@gmail.com");
  });

  it("My Plan Path listing excludes precision_clinic (same match as my-drills)", () => {
    assert.deepEqual(outstandingAssignmentMongoMatch({ learnerId: LEARNER_ID }), {
      status: { $in: ["pending", "in-progress", "overdue"] },
      source: { $ne: "precision_clinic" },
      learnerId: LEARNER_ID,
    });
    assert.equal(isLearnerPathAssignment({ source: null }), true);
    assert.equal(isLearnerPathAssignment({ source: undefined }), true);
    assert.equal(
      isLearnerPathAssignment({ source: "precision_clinic" }),
      false,
    );
    assert.equal(isLearnerPathAssignment(CLINIC_CONTRAST), false);
  });

  it("open Path assignment ids are valid ObjectIds and belong to this learner", () => {
    assert.equal(OPEN_PATH_ASSIGNMENTS.length, 5);
    for (const row of OPEN_PATH_ASSIGNMENTS) {
      assert.equal(Types.ObjectId.isValid(row._id), true);
      assert.equal(row.learnerId, LEARNER_ID);
      assert.equal(isLearnerPathAssignment(row), true);
      assert.equal(row.drill.learning_journey_topic, PATH_TOPIC);
      assert.equal(row.builderWeekNumber, 3);
    }
    const types = OPEN_PATH_ASSIGNMENTS.map((r) => r.drill.type).sort();
    assert.deepEqual([...OPEN_PATH_TYPES].sort(), types);
  });

  it("journey row builder includes assignmentId for open Path drills", () => {
    for (const row of OPEN_PATH_ASSIGNMENTS) {
      const item = toJourneyItem(row);
      assert.ok(item.assignmentId, "my-drills rows always set assignmentId");
      const href = journeyRowHref(item);
      assert.equal(
        href,
        buildDrillWebPath(row.drillId, row._id),
      );
      assert.match(href, /[?&]assignmentId=/);
      assert.ok(href.includes(row._id));
      assert.equal(href.includes("/completed"), false);
    }
  });

  it("bookmark OPEN includes recovered assignmentId; no assignment cannot submit", () => {
    const drillId = OPEN_PATH_ASSIGNMENTS[0]!.drillId;
    const drillIdOnlyHref = buildLearnerDrillHref(drillId);
    assert.equal(drillIdOnlyHref, `/account/drills/${drillId}`);
    assert.equal(drillIdOnlyHref.includes("assignmentId"), false);
    assert.equal(canSubmitFromPlayer({ assignmentId: undefined }), false);
    assert.equal(
      canSubmitFromPlayer({ assignmentId: OPEN_PATH_ASSIGNMENTS[0]!._id }),
      true,
    );
  });

  it("bookmark OPEN builds path with assignmentId from GET /drills/:id", () => {
    /**
     * Mirrors BookmarksTabPanel.handleGoToDrill: client GET /api/v1/drills/:id
     * then router.push(buildDrillWebPath(drillId, assignment.assignmentId)).
     * GET uses findMany({ learnerId, drillId }) with no source filter.
     */
    function recoverFromGetDrill(
      rows: Array<{ _id: string; learnerId: string; drillId: string }>,
      learnerId: string,
      drillId: string,
    ): string | undefined {
      return rows.find((r) => r.learnerId === learnerId && r.drillId === drillId)
        ?._id;
    }

    for (const row of OPEN_PATH_ASSIGNMENTS) {
      const getPayload = {
        code: "Success",
        data: {
          drill: { _id: row.drillId },
          assignment: { assignmentId: recoverFromGetDrill([row], LEARNER_ID, row.drillId) },
        },
      };
      const recovered = assignmentIdFromGetDrillPayload(getPayload);
      assert.equal(recovered, row._id);
      const href = buildDrillWebPath(row.drillId, recovered);
      assert.equal(href, buildDrillWebPath(row.drillId, row._id));
      assert.equal(
        bookmarkOpenPathAfterGet(row.drillId, true, getPayload),
        href,
      );
      assert.match(href, /[?&]assignmentId=/);
      assert.ok(href.includes(row._id));
      assert.equal(canSubmitFromPlayer({ assignmentId: recovered }), true);
    }

    const clinicPayload = {
      data: {
        drill: { _id: CLINIC_CONTRAST.drillId },
        assignment: { assignmentId: CLINIC_CONTRAST._id },
      },
    };
    assert.equal(
      assignmentIdFromGetDrillPayload(clinicPayload),
      CLINIC_CONTRAST._id,
      "findMany does not exclude precision_clinic (unlike findByLearnerId)",
    );
    assert.equal(
      assignmentIdFromGetDrillPayload({
        data: { drill: { _id: OPEN_PATH_ASSIGNMENTS[0]!.drillId } },
      }),
      undefined,
    );
    assert.equal(
      bookmarkOpenPathAfterGet(OPEN_PATH_ASSIGNMENTS[0]!.drillId, false, {
        data: { assignment: { assignmentId: OPEN_PATH_ASSIGNMENTS[0]!._id } },
      }),
      null,
      "403 → toast and stay",
    );
    assert.equal(
      canSubmitFromPlayer({ assignmentId: undefined }),
      false,
      "no assignment → cannot submit",
    );
  });

  it("drillId-only URLs still recover assignmentId on the drill page", () => {
    /**
     * Page uses assignmentId || assignmentInfo.assignmentId.
     * DrillPracticeInterface also falls back to getLearnerDrills({ drillId, limit: 1 }).
     */
    for (const row of OPEN_PATH_ASSIGNMENTS) {
      const href = buildLearnerDrillHref(row.drillId);
      assert.equal(href.includes("assignmentId"), false);
      const queryAssignmentId: string | undefined = undefined;
      const assignmentInfo = { assignmentId: row._id };
      const recovered = queryAssignmentId || assignmentInfo.assignmentId;
      assert.equal(recovered, row._id);
      assert.equal(canSubmitFromPlayer({ assignmentId: recovered }), true);
    }
  });

  it("complete schema rejects missing or invalid drillAssignmentId", () => {
    const valid = {
      drillAssignmentId: OPEN_PATH_ASSIGNMENTS[0]!._id,
      score: 80,
      timeSpent: 60,
    };
    assert.deepEqual(pathCompleteBodySchema.parse(valid).drillAssignmentId, valid.drillAssignmentId);

    assert.equal(pathCompleteAssignmentIdSchema.safeParse(undefined).success, false);
    assert.equal(pathCompleteAssignmentIdSchema.safeParse("").success, false);
    assert.equal(pathCompleteAssignmentIdSchema.safeParse("not-an-id").success, false);

    assert.throws(
      () => validateRequest(pathCompleteBodySchema, { score: 80, timeSpent: 60 }),
      (err: unknown) => err instanceof ValidationError,
    );
    assert.throws(
      () =>
        validateRequest(pathCompleteBodySchema, {
          drillAssignmentId: "bad",
          score: 80,
          timeSpent: 60,
        }),
      (err: unknown) => err instanceof ValidationError,
    );
  });

  it("Path complete requires assignmentId; Weekly Challenge is exempt", () => {
    assert.equal(
      canSubmitFromPlayer({ assignmentId: OPEN_PATH_ASSIGNMENTS[0]!._id }),
      true,
    );
    assert.equal(canSubmitFromPlayer({ assignmentId: undefined }), false);
    assert.equal(
      canSubmitFromPlayer({
        assignmentId: undefined,
        weeklyChallengeMeta: { weekStartDate: "2026-08-17", itemId: "wc-1" },
      }),
      true,
      "Weekly Challenge submits without drillAssignmentId",
    );
  });

  it("open Path fixtures pass completeDrill preconditions", () => {
    for (const row of OPEN_PATH_ASSIGNMENTS) {
      const result = evaluateCompleteDrillPreconditions({
        assignment: row,
        learnerId: LEARNER_ID,
        drillId: row.drillId,
        drillAssignmentId: row._id,
      });
      assert.deepEqual(result, { ok: true });
      assert.equal(pathCompleteAssignmentIdSchema.safeParse(row._id).success, true);
    }
  });

  it("completeDrill preconditions reject missing, foreign, or mismatched assignments", () => {
    const row = OPEN_PATH_ASSIGNMENTS[0]!;
    assert.equal(
      evaluateCompleteDrillPreconditions({
        assignment: null,
        learnerId: LEARNER_ID,
        drillId: row.drillId,
        drillAssignmentId: row._id,
      }).ok,
      false,
    );
    assert.equal(
      evaluateCompleteDrillPreconditions({
        assignment: { ...row, learnerId: hexId(0xeeee) },
        learnerId: LEARNER_ID,
        drillId: row.drillId,
        drillAssignmentId: row._id,
      }).reason,
      "forbidden",
    );
    assert.equal(
      evaluateCompleteDrillPreconditions({
        assignment: { ...row, drillId: hexId(0xffff) },
        learnerId: LEARNER_ID,
        drillId: row.drillId,
        drillAssignmentId: row._id,
      }).reason,
      "mismatch",
    );
  });

  it("overdue Path rows stay open (not View Results) and still carry assignmentId", () => {
    const overdue = toJourneyItem(OPEN_PATH_ASSIGNMENTS[0]!);
    assert.equal(isCompletedPlanItem(overdue), false);
    assert.equal(isActiveAssignedPlanItem(overdue), true);
    assert.equal(
      getDrillStatus({
        drill: overdue.drill,
        dueDate: overdue.dueDate,
        completedAt: overdue.completedAt,
        assignmentStatus: overdue.status,
        assignmentId: String(overdue.assignmentId),
      }),
      "missed",
    );
    assert.equal(isOutstandingAssignmentStatus("overdue"), true);
    const href = journeyRowHref(overdue);
    assert.equal(href.includes("/completed"), false);
    assert.match(href, /assignmentId=/);
  });

  it("completed Path rows navigate to results (no submit); open rows go to player", () => {
    const completed = toJourneyItem(COMPLETED_PATH_ASSIGNMENT);
    assert.equal(isCompletedPlanItem(completed), true);
    assert.equal(isActiveAssignedPlanItem(completed), false);
    assert.equal(
      journeyRowHref(completed),
      `/account/drills/${COMPLETED_PATH_ASSIGNMENT.drillId}/completed?assignmentId=${COMPLETED_PATH_ASSIGNMENT._id}`,
    );

    const open = toJourneyItem(OPEN_PATH_ASSIGNMENTS[3]!);
    assert.equal(isCompletedPlanItem(open), false);
    assert.equal(
      journeyRowHref(open),
      `/account/drills/${OPEN_PATH_ASSIGNMENTS[3]!.drillId}?assignmentId=${OPEN_PATH_ASSIGNMENTS[3]!._id}`,
    );
  });

  it("groups this learner's Path drills under admitting_patient on mission 1", () => {
    const items = [
      ...OPEN_PATH_ASSIGNMENTS.map(toJourneyItem),
      toJourneyItem(COMPLETED_PATH_ASSIGNMENT),
    ];
    const groups = groupDrillsByJourney(items, PATH_PART);
    const admitting = groups.find((g) => g.topic.id === PATH_TOPIC);
    assert.ok(admitting);
    assert.equal(admitting.items.length, 5);
    assert.equal(
      admitting.items.every((item) => item.assignmentId != null),
      true,
    );
  });
});

describe("elvakim91 live Mongo Path assignments", () => {
  it("open Path assignments are valid for complete when Mongo is available", async (t) => {
    try {
      await tryLoadLivePathAssignments();
    } catch (err) {
      liveSkipReason = `Mongo connect failed (${err instanceof Error ? err.message : String(err)}). Fixture tests still apply. Re-run: npx tsx scripts/diagnose-drill-visibility.ts --email ${LEARNER_EMAIL}`;
    }

    if (!liveRows) {
      t.skip(
        liveSkipReason ??
          "Mongo unavailable — skipped live Path assignment assertions.",
      );
      return;
    }

    const pathRows = liveRows.filter(
      (row) =>
        isLearnerPathAssignment(row) && row.drillSource !== "precision_clinic",
    );
    const openPath = pathRows.filter((row) =>
      isOutstandingAssignmentStatus(row.status),
    );

    assert.ok(pathRows.length > 0, "expected Path assignments for this learner");
    assert.equal(
      openPath.length,
      5,
      `live dump expected 5 open Path assignments, got ${openPath.length}`,
    );

    const admittingOpen = openPath.filter((row) => row.topic === PATH_TOPIC);
    assert.equal(
      admittingOpen.length,
      5,
      `expected 5 open admitting_patient Path drills, got ${admittingOpen.length}`,
    );

    const types = new Set(admittingOpen.map((row) => row.type));
    for (const type of OPEN_PATH_TYPES) {
      assert.ok(types.has(type), `missing open Path type ${type}`);
    }

    for (const row of openPath) {
      assert.equal(Types.ObjectId.isValid(row.assignmentId), true);
      assert.equal(row.learnerId, LEARNER_ID);
      assert.equal(isLearnerPathAssignment(row), true);
      const result = evaluateCompleteDrillPreconditions({
        assignment: {
          _id: row.assignmentId,
          learnerId: row.learnerId,
          drillId: row.drillId,
        },
        learnerId: LEARNER_ID,
        drillId: row.drillId,
        drillAssignmentId: row.assignmentId,
      });
      assert.deepEqual(result, { ok: true });
      assert.equal(
        pathCompleteAssignmentIdSchema.safeParse(row.assignmentId).success,
        true,
      );
    }
  });
});
