/**
 * End-to-end verification that a legacy ObjectId-keyed user (simulating a
 * pre-Better-Auth / mobile-native learner whose _id was stored as a real BSON
 * ObjectId) can still be assigned a drill and have it round-trip through the
 * same repository call the learner-facing GET /api/v1/drills/learner/my-drills
 * endpoint uses.
 *
 * This is the regression this task is guarding against: Schema.Types.Mixed
 * fields (learnerId, assignedBy, userId, etc.) stop auto-casting 24-char hex
 * strings into real Types.ObjectId values, so a query built with a raw string
 * would silently fail to match documents whose learnerId is stored as an
 * actual ObjectId BSON value (i.e. every pre-existing legacy learner).
 *
 * Usage:
 *   npx tsx scripts/verify-objectid-drill-visibility.ts
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import Drill from "../src/models/drill";
import DrillAssignment from "../src/models/drill-assignment";
import { AssignmentRepository } from "../src/domain/assignments/assignment.repository";

const TEST_EMAIL = `objectid-verify-${Date.now()}@example.test`;

async function main() {
  await connectToDatabase();

  let passed = true;
  const failures: string[] = [];
  let testUserId: Types.ObjectId | undefined;
  let testAssignmentId: string | undefined;

  try {
    // 1. Create a test user with a real BSON ObjectId _id, simulating a
    // legacy/mobile-native learner (pre-dates Better Auth UUID sign-ups).
    testUserId = new Types.ObjectId();
    console.log(`\n[1/6] Creating ObjectId test user _id=${testUserId} email=${TEST_EMAIL}`);

    await User.create({
      _id: testUserId,
      email: TEST_EMAIL,
      firstName: "ObjectId",
      lastName: "Verify",
      role: "user",
      isActive: true,
      hasProfile: true,
    });

    // 1b. Confirm the User model itself can look the user back up by its
    // ObjectId _id string form (mirrors how context.userId flows through the
    // rest of the app as a stringified id).
    const foundUser = await User.findById(testUserId.toString()).lean().exec();
    if (!foundUser) {
      failures.push("User.findById(objectIdString) returned null immediately after creating the user");
      passed = false;
    } else {
      console.log("[1/6] OK — User.findById(objectIdString) resolved the just-created user");
    }

    // 2. Find any existing drill to assign.
    console.log("\n[2/6] Finding an existing drill to assign");
    const drill = await Drill.findOne({}).select("_id title").lean().exec();
    if (!drill) {
      throw new Error(
        "No drills exist in the database — cannot verify assignment round-trip. " +
          "Create at least one drill and re-run this script."
      );
    }
    console.log(`[2/6] OK — using drill ${drill._id} (${(drill as any).title ?? "untitled"})`);

    // 3. Create a DrillAssignment directly against the ObjectId user, storing
    // learnerId as a *real BSON ObjectId* (mirroring how every pre-existing
    // legacy assignment is actually stored in the DB), not a raw string.
    console.log("\n[3/6] Creating DrillAssignment for the ObjectId user (learnerId stored as real ObjectId)");
    const assignment = await DrillAssignment.create({
      drillId: drill._id,
      learnerId: testUserId,
      assignedBy: testUserId,
      assignedAt: new Date(),
      status: "pending",
    });
    testAssignmentId = String(assignment._id);
    console.log(`[3/6] OK — created assignment ${testAssignmentId}`);

    // 3b. Sanity-check the stored learnerId is actually a BSON ObjectId, not
    // a string. If this is false, the test setup itself is invalid.
    const raw = await DrillAssignment.collection.findOne({ _id: assignment._id });
    const storedIsObjectId = raw?.learnerId instanceof mongoose.Types.ObjectId;
    console.log(
      `[3/6] Stored learnerId type check: ${storedIsObjectId ? "BSON ObjectId (expected)" : "NOT an ObjectId (test invalid!)"}`
    );
    if (!storedIsObjectId) {
      failures.push("Test setup invalid: learnerId was not stored as a real BSON ObjectId");
      passed = false;
    }

    // 4. Read it back via the same repository method the learner-facing
    // my-drills endpoint uses, passing the learnerId as a *raw hex string*
    // (exactly like context.userId flows through the API layer).
    console.log("\n[4/6] Calling assignmentRepo.findByLearnerId(hexString, { limit: 10 })");
    const assignmentRepo = new AssignmentRepository();
    const { assignments, total } = await assignmentRepo.findByLearnerId(testUserId.toString(), {
      limit: 10,
    });

    // 5. Assert the assignment is returned.
    console.log("\n[5/6] Asserting the assignment round-trips");
    const found = assignments.find((a: any) => String(a._id) === testAssignmentId);
    if (!found) {
      failures.push(
        `findByLearnerId did not return the created assignment. total=${total}, ` +
          `returned=${assignments.length}`
      );
      passed = false;
    } else {
      console.log("[5/6] OK — assignment found via findByLearnerId (hex string correctly matched stored ObjectId)");
    }
  } catch (err: any) {
    passed = false;
    failures.push(`Unexpected error: ${err.message}`);
    console.error(err);
  } finally {
    // 6. Clean up test data regardless of outcome.
    console.log("\n[6/6] Cleaning up test data");
    try {
      if (testAssignmentId) {
        await DrillAssignment.deleteOne({ _id: testAssignmentId }).exec();
      }
      if (testUserId) {
        await User.deleteOne({ _id: testUserId }).exec();
      }
      console.log("[6/6] OK — cleanup complete");
    } catch (cleanupErr: any) {
      console.error("Cleanup failed (manual cleanup may be required):", cleanupErr.message);
      if (testUserId) console.error(`  Test user _id: ${testUserId} (${TEST_EMAIL})`);
      if (testAssignmentId) console.error(`  Test assignment _id: ${testAssignmentId}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  if (passed) {
    console.log("PASS — legacy ObjectId-keyed learner's drill assignment");
    console.log("       (learnerId stored as a real BSON ObjectId) round-trips");
    console.log("       through AssignmentRepository.findByLearnerId (the same");
    console.log("       call GET /api/v1/drills/learner/my-drills uses) when");
    console.log("       queried with a raw hex string id.");
  } else {
    console.log("FAIL — legacy ObjectId drill visibility is broken:");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }
  console.log("=".repeat(60));

  await mongoose.disconnect();
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
