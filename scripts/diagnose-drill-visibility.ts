/**
 * Diagnose drill visibility for a specific student.
 * Checks subscription state, drill_assignments rows, and orphan drills.
 *
 * Usage:
 *   npx tsx scripts/diagnose-drill-visibility.ts --email student@example.com
 *   npx tsx scripts/diagnose-drill-visibility.ts --userId 6962512f843eb475d11a9556
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import Drill from "../src/models/drill";
import DrillAssignment from "../src/models/drill-assignment";
import { isUserSubscribed } from "../src/lib/api/user-subscription";
import { isValidUserId, toUserIdQuery } from "../src/lib/api/user-id";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

const targetEmail = argValue("--email")?.trim().toLowerCase();
const targetUserId = argValue("--userId")?.trim();

async function main() {
  if (!targetEmail && !targetUserId) {
    console.error(
      "Usage: npx tsx scripts/diagnose-drill-visibility.ts --email <email> OR --userId <userId>"
    );
    process.exit(1);
  }

  await connectToDatabase();

  // 1. Find user
  let user: Awaited<ReturnType<typeof User.findOne>>;
  if (targetEmail) {
    user = await User.findOne({ email: targetEmail }).exec();
    if (!user) {
      console.error(`No user found for email: ${targetEmail}`);
      process.exit(1);
    }
  } else {
    // Accepts UUID (Better Auth web sign-up, incl. Google/Apple OAuth) or
    // ObjectId (legacy/mobile) user ids. User._id is Schema.Types.Mixed, so
    // findById works unmodified for both formats.
    if (!isValidUserId(targetUserId!)) {
      console.error(`Invalid userId format: ${targetUserId}`);
      process.exit(1);
    }
    user = await User.findById(targetUserId).exec();
    if (!user) {
      console.error(`No user found for userId: ${targetUserId}`);
      process.exit(1);
    }
  }

  const userId = String(user!._id);
  const u = user!;

  console.log("\n=== 1. User subscription fields ===");
  console.log(
    JSON.stringify(
      {
        userId,
        email: u.email,
        role: u.role ?? "(unset)",
        subscriptionPlan: u.subscriptionPlan ?? "free",
        subscriptionExpiresAt: u.subscriptionExpiresAt ?? null,
        stripeSubscriptionStatus: (u as any).stripeSubscriptionStatus ?? null,
        subscriptionPaymentMethod: (u as any).subscriptionPaymentMethod ?? null,
        isActive: (u as any).isActive ?? null,
      },
      null,
      2
    )
  );

  // 2. Computed isUserSubscribed
  const subscribed = isUserSubscribed(u);
  console.log("\n=== 2. isUserSubscribed result ===");
  console.log(JSON.stringify({ isSubscribed: subscribed }, null, 2));

  // 3. Count drill_assignments rows for learnerId
  const learnerObjectId = toUserIdQuery(userId);
  const assignmentCount = await DrillAssignment.countDocuments({
    learnerId: learnerObjectId,
  }).exec();
  console.log("\n=== 3. drill_assignments count ===");
  console.log(JSON.stringify({ drillAssignmentCount: assignmentCount }, null, 2));

  // 4. List each DrillAssignment with drill details
  const assignments = await DrillAssignment.find({ learnerId: learnerObjectId })
    .populate({ path: "drillId", select: "title learning_journey_part learning_journey_topic" })
    .lean()
    .exec();

  console.log("\n=== 4. DrillAssignment rows ===");
  console.log(
    JSON.stringify(
      assignments.map((a: any) => ({
        assignmentId: String(a._id),
        drillId: String(a.drillId?._id ?? a.drillId),
        drillTitle: a.drillId?.title ?? "(drill missing)",
        learning_journey_part: a.drillId?.learning_journey_part ?? null,
        learning_journey_topic: a.drillId?.learning_journey_topic ?? null,
        status: a.status,
        dueDate: a.dueDate ?? null,
        assignedAt: a.assignedAt ?? null,
      })),
      null,
      2
    )
  );

  // 5. Find drills where assigned_to includes this userId but no DrillAssignment exists
  const assignedToDrills = await Drill.find({ assigned_to: learnerObjectId })
    .select("_id title learning_journey_part learning_journey_topic")
    .lean()
    .exec();

  const assignmentDrillIdSet = new Set(
    assignments.map((a: any) => String(a.drillId?._id ?? a.drillId))
  );

  const orphanDrills = assignedToDrills.filter(
    (d: any) => !assignmentDrillIdSet.has(String(d._id))
  );

  console.log(
    "\n=== 5. Orphan count (assigned_to has userId but no DrillAssignment row) ==="
  );
  console.log(
    JSON.stringify(
      {
        totalInAssignedTo: assignedToDrills.length,
        withMatchingAssignment: assignedToDrills.length - orphanDrills.length,
        orphanCount: orphanDrills.length,
      },
      null,
      2
    )
  );

  // 6. Orphan drill details
  console.log("\n=== 6. Orphan drill details ===");
  console.log(
    JSON.stringify(
      orphanDrills.map((d: any) => ({
        _id: String(d._id),
        title: d.title ?? "(untitled)",
        learning_journey_part: d.learning_journey_part ?? null,
        learning_journey_topic: d.learning_journey_topic ?? null,
      })),
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
