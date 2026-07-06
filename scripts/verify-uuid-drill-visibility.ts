/**
 * End-to-end verification that a UUID-keyed user (simulating a Better Auth
 * web sign-up, incl. Google/Apple OAuth) can be assigned a drill and have it
 * round-trip through the same repository call the learner-facing
 * GET /api/v1/drills/learner/my-drills endpoint uses.
 *
 * Several of the code paths this fix touches previously swallowed Mongoose
 * CastErrors and silently fell back to empty/default data, so a scripted
 * assertion is required instead of relying on manual QA.
 *
 * Usage:
 *   npx tsx scripts/verify-uuid-drill-visibility.ts
 */
import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import Drill from "../src/models/drill";
import DrillAssignment from "../src/models/drill-assignment";
import { AssignmentRepository } from "../src/domain/assignments/assignment.repository";

const TEST_EMAIL = `uuid-verify-${Date.now()}@example.test`;

async function main() {
  await connectToDatabase();

  let passed = true;
  const failures: string[] = [];
  let testUserId: string | undefined;
  let testAssignmentId: string | undefined;

  try {
    // 1. Create a test user with a UUID _id, simulating a Better Auth web
    // sign-up (incl. Google/Apple OAuth) account.
    testUserId = crypto.randomUUID();
    console.log(`\n[1/6] Creating UUID test user _id=${testUserId} email=${TEST_EMAIL}`);

    await User.create({
      _id: testUserId,
      email: TEST_EMAIL,
      firstName: "UUID",
      lastName: "Verify",
      role: "user",
      isActive: true,
      hasProfile: true,
    });

    // 1b. Confirm the User model itself can look the user back up by its
    // UUID _id without a CastError (Phase 0.5).
    const foundUser = await User.findById(testUserId).lean().exec();
    if (!foundUser) {
      failures.push("User.findById(uuid) returned null immediately after creating the user");
      passed = false;
    } else {
      console.log("[1/6] OK — User.findById(uuid) resolved the just-created user");
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

    // 3. Create a DrillAssignment directly against the UUID user (mirrors
    // what /api/v1/drills/[drillId]/assign/route.ts does).
    console.log("\n[3/6] Creating DrillAssignment for the UUID user");
    const assignment = await DrillAssignment.create({
      drillId: drill._id,
      learnerId: testUserId,
      assignedBy: testUserId,
      assignedAt: new Date(),
      status: "pending",
    });
    testAssignmentId = String(assignment._id);
    console.log(`[3/6] OK — created assignment ${testAssignmentId}`);

    // 4. Read it back via the same repository method the learner-facing
    // my-drills endpoint uses.
    console.log("\n[4/6] Calling assignmentRepo.findByLearnerId(uuid, { limit: 10 })");
    const assignmentRepo = new AssignmentRepository();
    const { assignments, total } = await assignmentRepo.findByLearnerId(testUserId, {
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
      console.log("[5/6] OK — assignment found via findByLearnerId");
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
    console.log("PASS — UUID user can be assigned a drill and it round-trips");
    console.log("       through AssignmentRepository.findByLearnerId (the same");
    console.log("       call GET /api/v1/drills/learner/my-drills uses).");
  } else {
    console.log("FAIL — UUID drill visibility is still broken:");
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
