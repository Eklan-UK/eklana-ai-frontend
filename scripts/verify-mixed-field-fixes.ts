/**
 * Targeted verification for the three route-level Mixed-field cast gaps
 * fixed in this pass:
 *   - src/app/api/v1/drills/[drillId]/checkpoint/route.ts (DrillCheckpoint.userId)
 *   - src/app/api/v1/drills/[drillId]/roleplay-progress/route.ts (RoleplayDrillProgress.userId)
 *   - src/app/api/v1/ai/free-talk/attempts/route.ts (FreeTalkAttempt.learnerId)
 *
 * Each of these fields is Schema.Types.Mixed. Before the fix, these routes
 * queried/wrote them using the raw context.userId string. For legacy
 * ObjectId-keyed learners, a document created with the field stored as a
 * real BSON ObjectId would never be found again by a later raw-string query
 * (Mixed fields don't auto-cast). This script simulates that exact scenario
 * directly against the models, using toUserIdQuery exactly as the fixed
 * routes now do.
 *
 * Usage:
 *   npx tsx scripts/verify-mixed-field-fixes.ts
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import DrillCheckpoint from "../src/models/drill-checkpoint";
import RoleplayDrillProgress from "../src/models/roleplay-drill-progress";
import FreeTalkAttempt from "../src/models/free-talk-attempt";
import Drill from "../src/models/drill";
import { toUserIdQuery } from "../src/lib/api/user-id";

const failures: string[] = [];
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  OK — ${label}`);
  } else {
    console.log(`  FAIL — ${label}`);
    failures.push(label);
  }
}

async function verifyDrillCheckpoint(legacyUserId: Types.ObjectId, drillId: Types.ObjectId) {
  console.log("\n=== DrillCheckpoint (userId Mixed field) ===");
  const drillAssignmentId = new Types.ObjectId();

  // Simulate storage exactly as it exists for real legacy learners: userId
  // stored as a genuine BSON ObjectId (this happened naturally before the
  // Mixed migration, and pre-existing rows are untouched by the migration).
  const doc = await DrillCheckpoint.create({
    userId: legacyUserId,
    drillId,
    drillAssignmentId,
    drillType: "vocabulary",
    resumeFromIndex: 2,
    completedItemCount: 2,
  });
  cleanup.push(() => DrillCheckpoint.deleteOne({ _id: doc._id }).exec());

  const raw = await DrillCheckpoint.collection.findOne({ _id: doc._id });
  check("stored userId is a real BSON ObjectId", raw?.userId instanceof mongoose.Types.ObjectId);

  // This mirrors the fixed GET/POST/DELETE handlers: userId: toUserIdQuery(context.userId)
  const found = await DrillCheckpoint.findOne({
    userId: toUserIdQuery(legacyUserId.toString()),
    drillAssignmentId,
  }).exec();
  check("findOne with toUserIdQuery(hexString) matches the stored ObjectId row", !!found);

  // Sanity: confirm the OLD buggy behavior (raw string, no cast) would NOT match.
  const foundWithRawString = await DrillCheckpoint.findOne({
    userId: legacyUserId.toString(),
    drillAssignmentId,
  }).exec();
  check(
    "control: raw string query (pre-fix behavior) fails to match, confirming the regression is real",
    !foundWithRawString
  );
}

async function verifyRoleplayProgress(legacyUserId: Types.ObjectId, drillId: Types.ObjectId) {
  console.log("\n=== RoleplayDrillProgress (userId Mixed field) ===");
  const drillAssignmentId = new Types.ObjectId();

  const doc = await RoleplayDrillProgress.create({
    userId: legacyUserId,
    source: "assignment",
    drillId,
    drillAssignmentId,
    currentSceneIndex: 1,
    currentTurnIndex: 0,
  });
  cleanup.push(() => RoleplayDrillProgress.deleteOne({ _id: doc._id }).exec());

  const raw = await RoleplayDrillProgress.collection.findOne({ _id: doc._id });
  check("stored userId is a real BSON ObjectId", raw?.userId instanceof mongoose.Types.ObjectId);

  // Mirrors the fixed buildProgressFilter(userId) -> { userId: toUserIdQuery(userId) }
  const found = await RoleplayDrillProgress.findOne({
    userId: toUserIdQuery(legacyUserId.toString()),
    drillAssignmentId,
  }).exec();
  check("findOne with toUserIdQuery(hexString) matches the stored ObjectId row", !!found);

  const foundWithRawString = await RoleplayDrillProgress.findOne({
    userId: legacyUserId.toString(),
    drillAssignmentId,
  }).exec();
  check(
    "control: raw string query (pre-fix behavior) fails to match, confirming the regression is real",
    !foundWithRawString
  );
}

async function verifyFreeTalkAttempt(legacyUserId: Types.ObjectId) {
  console.log("\n=== FreeTalkAttempt (learnerId Mixed field) ===");

  // Mirrors the fixed postHandler: learnerId: toUserIdQuery(context.userId.toString())
  const doc = await FreeTalkAttempt.create({
    learnerId: toUserIdQuery(legacyUserId.toString()),
    scenarioId: "scenario-1",
    scenarioTitle: "Test Scenario",
    scenarioType: "roleplay",
    feedbackText: "",
    gradeResult: null,
  });
  cleanup.push(() => FreeTalkAttempt.deleteOne({ _id: doc._id }).exec());

  const raw = await FreeTalkAttempt.collection.findOne({ _id: doc._id });
  check(
    "toUserIdQuery on create stores learnerId as a real BSON ObjectId (matches legacy storage convention)",
    raw?.learnerId instanceof mongoose.Types.ObjectId
  );

  // Mirrors the fixed getHandler: filter: { learnerId: toUserIdQuery(context.userId.toString()) }
  const found = await FreeTalkAttempt.findOne({
    learnerId: toUserIdQuery(legacyUserId.toString()),
  }).exec();
  check("findOne with toUserIdQuery(hexString) matches the stored ObjectId row", !!found);

  const foundWithRawString = await FreeTalkAttempt.findOne({
    learnerId: legacyUserId.toString(),
  }).exec();
  check(
    "control: raw string query (pre-fix behavior) fails to match, confirming the regression is real",
    !foundWithRawString
  );
}

async function main() {
  await connectToDatabase();

  const legacyUserId = new Types.ObjectId();
  console.log(`Using synthetic legacy ObjectId learner id: ${legacyUserId}`);

  const drill = await Drill.findOne({}).select("_id").lean().exec();
  if (!drill) {
    throw new Error("No drills exist in the database — cannot run this verification.");
  }
  const drillId = drill._id as Types.ObjectId;

  try {
    await verifyDrillCheckpoint(legacyUserId, drillId);
    await verifyRoleplayProgress(legacyUserId, drillId);
    await verifyFreeTalkAttempt(legacyUserId);
  } finally {
    console.log("\nCleaning up test data...");
    for (const fn of cleanup) {
      await fn().catch((e) => console.error("cleanup error:", e.message));
    }
  }

  console.log("\n" + "=".repeat(60));
  if (failures.length === 0) {
    console.log("PASS — all Mixed-field fixes verified for legacy ObjectId learners");
  } else {
    console.log(`FAIL — ${failures.length} check(s) failed:`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log("=".repeat(60));

  await mongoose.disconnect();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
