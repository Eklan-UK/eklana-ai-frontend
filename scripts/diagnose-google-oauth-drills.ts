/**
 * Diagnose Google OAuth students who cannot see drills on My Plan.
 *
 * Usage:
 *   npx tsx scripts/diagnose-google-oauth-drills.ts
 *   npx tsx scripts/diagnose-google-oauth-drills.ts --email student@example.com
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import DrillAssignment from "../src/models/drill-assignment";
import Profile from "../src/models/profile";
import { isUserSubscribed } from "../src/lib/api/user-subscription";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

const targetEmail = argValue("--email")?.trim().toLowerCase();

function idKind(id: unknown): "objectId" | "uuid" | "other" {
  const s = String(id);
  if (/^[a-f0-9]{24}$/i.test(s)) return "objectId";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "uuid";
  return "other";
}

function canParseAsObjectId(id: string): boolean {
  try {
    if (!Types.ObjectId.isValid(id)) return false;
    new Types.ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

type AccountRow = {
  userId?: string;
  provider?: string;
  providerAccountId?: string;
};

async function getGoogleAccountUserIds(): Promise<Set<string>> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No db connection");
  const accounts = await db
    .collection("accounts")
    .find({ provider: "google" })
    .project({ userId: 1 })
    .toArray();
  return new Set(accounts.map((a: AccountRow) => String(a.userId)));
}

async function summarizeUser(user: InstanceType<typeof User>) {
  const userId = String(user._id);
  const assignmentQuery = canParseAsObjectId(userId)
    ? { learnerId: new Types.ObjectId(userId) }
    : { learnerId: userId };

  const [assignmentCount, profile] = await Promise.all([
    DrillAssignment.countDocuments(assignmentQuery).exec(),
    Profile.findOne({ userId: canParseAsObjectId(userId) ? new Types.ObjectId(userId) : userId })
      .select("_id")
      .lean()
      .exec(),
  ]);

  const issues: string[] = [];

  if (user.role && user.role !== "user") {
    issues.push(`role=${user.role} (my-drills requires "user")`);
  }
  if (!canParseAsObjectId(userId)) {
    issues.push(`user _id is ${idKind(userId)} — API uses new Types.ObjectId(session.user.id) which fails for UUIDs`);
  }
  if (!isUserSubscribed(user)) {
    issues.push("not subscribed — My Plan redirects to /account/settings/subscriptions");
  }
  if (!user.hasProfile && !profile) {
    issues.push("no profile / hasProfile=false — may still be in onboarding");
  }
  if (assignmentCount === 0) {
    issues.push("zero drill_assignments rows for this learnerId");
  }
  if (!user.firstName?.trim() || !user.lastName?.trim()) {
    issues.push("missing firstName or lastName (Better Auth marks both required)");
  }

  return {
    userId,
    idKind: idKind(userId),
    email: user.email,
    role: user.role ?? "(unset)",
    hasProfile: user.hasProfile ?? null,
    hasProfileDoc: !!profile,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    isSubscribed: isUserSubscribed(user),
    drillAssignments: assignmentCount,
    createdAt: user.createdAt,
    issues,
  };
}

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db!;

  if (targetEmail) {
    const user = await User.findOne({ email: targetEmail }).exec();
    if (!user) {
      console.error(`No user found for email: ${targetEmail}`);
      process.exit(1);
    }
    const googleIds = await getGoogleAccountUserIds();
    const isGoogle = googleIds.has(String(user._id)) || googleIds.has(String((user as { id?: string }).id));
    console.log("\n=== Single user drill diagnostic ===");
    console.log(JSON.stringify({ isGoogleOAuth: isGoogle, ...(await summarizeUser(user)) }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const googleUserIds = await getGoogleAccountUserIds();
  console.log(`\nFound ${googleUserIds.size} Google-linked accounts in "accounts" collection`);

  const googleUsers: Array<Awaited<ReturnType<typeof summarizeUser>>> = [];
  for (const rawId of googleUserIds) {
    let user = await User.findById(rawId).exec();
    if (!user && Types.ObjectId.isValid(rawId)) {
      user = await User.findById(new Types.ObjectId(rawId)).exec();
    }
    if (!user) {
      googleUsers.push({
        userId: rawId,
        idKind: idKind(rawId),
        email: "(user doc missing)",
        role: "(missing)",
        hasProfile: null,
        hasProfileDoc: false,
        subscriptionPlan: "n/a",
        isSubscribed: false,
        drillAssignments: 0,
        createdAt: undefined as unknown as Date,
        issues: ["accounts row points to missing user document"],
      });
      continue;
    }
    googleUsers.push(await summarizeUser(user));
  }

  const withIssues = googleUsers.filter((u) => u.issues.length > 0);
  const noDrills = googleUsers.filter((u) => u.drillAssignments === 0);
  const uuidUsers = googleUsers.filter((u) => u.idKind === "uuid");
  const unsubscribed = googleUsers.filter((u) => !u.isSubscribed);

  console.log("\n=== Google OAuth users summary ===");
  console.log(
    JSON.stringify(
      {
        total: googleUsers.length,
        withAnyIssue: withIssues.length,
        zeroDrillAssignments: noDrills.length,
        uuidUserIds: uuidUsers.length,
        notSubscribed: unsubscribed.length,
        cannotParseObjectId: googleUsers.filter((u) => !canParseAsObjectId(u.userId)).length,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Recent Google OAuth users (last 10) ===");
  const recent = [...googleUsers]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 10);
  console.log(JSON.stringify(recent, null, 2));

  // Compare with recent email/password users (no google account)
  const emailOnlyUsers = await User.find({
    _id: { $nin: [...googleUserIds].map((id) => (Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id)) },
    role: { $in: ["user", null] },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .exec();

  const emailSummaries = await Promise.all(emailOnlyUsers.map((u) => summarizeUser(u)));
  const emailWithGoogle = emailSummaries.filter((u) => googleUserIds.has(u.userId));

  console.log("\n=== Recent non-Google students (last 10, for comparison) ===");
  console.log(
    JSON.stringify(
      emailSummaries.filter((u) => !emailWithGoogle.some((g) => g.userId === u.userId)),
      null,
      2,
    ),
  );

  // Check for assignment learnerId format mismatches
  const mismatchSample = await DrillAssignment.aggregate([
    { $limit: 500 },
    {
      $lookup: {
        from: "users",
        localField: "learnerId",
        foreignField: "_id",
        as: "userMatch",
      },
    },
    { $match: { userMatch: { $size: 0 } } },
    { $limit: 5 },
    { $project: { learnerId: 1, drillId: 1, status: 1 } },
  ]).exec();

  console.log("\n=== Sample drill_assignments with no matching user._id (up to 5) ===");
  console.log(JSON.stringify(mismatchSample, null, 2));

  const totalAssignments = await DrillAssignment.countDocuments().exec();
  const totalUsers = await User.countDocuments({ role: { $in: ["user", null] } }).exec();
  console.log("\n=== Global counts ===");
  console.log(JSON.stringify({ totalUsers, totalAssignments, googleOAuthUsers: googleUsers.length }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
