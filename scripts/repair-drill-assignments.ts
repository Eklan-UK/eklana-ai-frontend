/**
 * Repair drill assignments for a specific student.
 * Creates DrillAssignment documents for drills present in drill.assigned_to
 * that have no matching DrillAssignment row.
 *
 * Usage (dry-run by default — no changes made):
 *   npx tsx scripts/repair-drill-assignments.ts --email student@example.com
 *   npx tsx scripts/repair-drill-assignments.ts --userId 6962512f843eb475d11a9556
 *
 * Apply changes:
 *   npx tsx scripts/repair-drill-assignments.ts --email student@example.com --apply
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import Drill from "../src/models/drill";
import DrillAssignment from "../src/models/drill-assignment";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const targetEmail = argValue("--email")?.trim().toLowerCase();
const targetUserId = argValue("--userId")?.trim();
const dryRun = !hasFlag("--apply");

function canParseAsObjectId(id: string): boolean {
  try {
    if (!Types.ObjectId.isValid(id)) return false;
    new Types.ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!targetEmail && !targetUserId) {
    console.error(
      "Usage: npx tsx scripts/repair-drill-assignments.ts --email <email> OR --userId <userId> [--apply]"
    );
    process.exit(1);
  }

  console.log(
    `\nMode: ${dryRun ? "DRY RUN (no changes — pass --apply to apply)" : "APPLY (making changes)"}`
  );

  await connectToDatabase();

  // Find user
  let user: Awaited<ReturnType<typeof User.findOne>>;
  if (targetEmail) {
    user = await User.findOne({ email: targetEmail }).exec();
    if (!user) {
      console.error(`No user found for email: ${targetEmail}`);
      process.exit(1);
    }
  } else {
    if (!canParseAsObjectId(targetUserId!)) {
      console.error(`Invalid userId format: ${targetUserId}`);
      process.exit(1);
    }
    user = await User.findById(new Types.ObjectId(targetUserId)).exec();
    if (!user) {
      console.error(`No user found for userId: ${targetUserId}`);
      process.exit(1);
    }
  }

  const userId = String(user!._id);
  if (!canParseAsObjectId(userId)) {
    console.error(`Cannot convert userId to ObjectId: ${userId}`);
    process.exit(1);
  }

  const learnerObjectId = new Types.ObjectId(userId);
  console.log(`\nUser: ${user!.email} (${userId})`);

  // Find all drills where assigned_to includes this learner
  const assignedToDrills = await Drill.find({ assigned_to: learnerObjectId })
    .select("_id title createdById learning_journey_part learning_journey_topic")
    .lean()
    .exec();

  console.log(`Drills in assigned_to: ${assignedToDrills.length}`);

  // Find existing DrillAssignment rows
  const existingAssignments = await DrillAssignment.find({
    learnerId: learnerObjectId,
  })
    .select("drillId")
    .lean()
    .exec();

  const existingDrillIdSet = new Set(
    existingAssignments.map((a: any) => String(a.drillId))
  );

  console.log(`Existing DrillAssignment rows: ${existingAssignments.length}`);

  // Identify orphan drills
  const orphanDrills = assignedToDrills.filter(
    (d: any) => !existingDrillIdSet.has(String(d._id))
  );

  console.log(`Orphan drills (need DrillAssignment): ${orphanDrills.length}`);

  if (orphanDrills.length === 0) {
    console.log("\nNothing to repair. All assigned drills already have DrillAssignment rows.");
    await mongoose.disconnect();
    return;
  }

  // Get a fallback system admin for assignedBy
  const systemAdmin = await User.findOne({ role: "admin" })
    .select("_id")
    .lean()
    .exec();

  type ResultRow = { drillId: string; title: string; status: string };
  const results: ResultRow[] = [];
  let created = 0;
  let skipped = 0;

  for (const drill of orphanDrills) {
    const drillId = drill._id as Types.ObjectId;
    const drillTitle = (drill as any).title ?? "(untitled)";

    const assignedBy: Types.ObjectId =
      (drill as any).createdById instanceof Types.ObjectId
        ? (drill as any).createdById
        : systemAdmin
          ? (systemAdmin._id as Types.ObjectId)
          : learnerObjectId;

    if (dryRun) {
      results.push({
        drillId: String(drillId),
        title: drillTitle,
        status: "would create",
      });
      continue;
    }

    try {
      await DrillAssignment.create({
        drillId,
        learnerId: learnerObjectId,
        assignedBy,
        assignedAt: new Date(),
        status: "pending",
      });
      results.push({ drillId: String(drillId), title: drillTitle, status: "created" });
      created++;
    } catch (err: any) {
      if (err.code === 11000) {
        results.push({
          drillId: String(drillId),
          title: drillTitle,
          status: "already exists (skipped)",
        });
        skipped++;
      } else {
        results.push({
          drillId: String(drillId),
          title: drillTitle,
          status: `error: ${err.message}`,
        });
      }
    }
  }

  console.log("\n=== Results ===");
  console.log(JSON.stringify(results, null, 2));

  if (dryRun) {
    console.log(
      `\nDry run complete. Would create ${orphanDrills.length} DrillAssignment(s). Pass --apply to make changes.`
    );
  } else {
    console.log(`\nDone. Created: ${created}, Already existed (skipped): ${skipped}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
