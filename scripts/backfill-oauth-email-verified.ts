/**
 * Backfill emailVerified/isEmailVerified=true for users linked to a
 * Google or Apple account, matching account rows under *either* schema:
 *   - mobile custom schema: provider / providerAccountId
 *     (written by src/app/api/v1/auth/verify-id-token/route.ts)
 *   - Better Auth's own schema: providerId / accountId
 *     (written by web OAuth/credential linking, see
 *     src/lib/api/password-account.ts)
 *
 * Signing in with Google/Apple already proves email ownership, so any user
 * linked to one of these accounts should have both verification flags set —
 * this repairs accounts that were affected by the bug fixed in
 * verify-id-token/route.ts (account-linking paths that never set the
 * verification flags) before that fix shipped.
 *
 * Safe to re-run: only updates documents where a flag isn't already true.
 *
 * Usage:
 *   npx tsx scripts/backfill-oauth-email-verified.ts
 *   npm run backfill:oauth-verified
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "../src/lib/api/db";
import { isValidUserId, toUserIdQueryMulti } from "../src/lib/api/user-id";

type AccountRow = {
  userId?: unknown;
  provider?: string;
  providerId?: string;
};

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("Database connection not available");
  }

  const accountsCollection = db.collection("accounts");
  const usersCollection = db.collection("users");

  // Match google/apple links under either schema.
  const oauthAccounts = (await accountsCollection
    .find({
      $or: [
        { provider: { $in: ["google", "apple"] } },
        { providerId: { $in: ["google", "apple"] } },
      ],
    })
    .project({ userId: 1, provider: 1, providerId: 1 })
    .toArray()) as AccountRow[];

  console.log(`Found ${oauthAccounts.length} google/apple account rows.`);

  const rawUserIds = [
    ...new Set(
      oauthAccounts
        .map((a) => (a.userId === undefined || a.userId === null ? "" : String(a.userId)))
        .filter((id) => id.length > 0)
    ),
  ];

  // Guard against malformed/unexpected userId values (toUserIdQuery throws
  // for anything that isn't a 24-char hex ObjectId or a UUID) instead of
  // crashing the whole backfill over a handful of bad rows.
  const validUserIds = rawUserIds.filter((id) => isValidUserId(id));
  const skipped = rawUserIds.length - validUserIds.length;

  console.log(
    `Distinct userIds: ${rawUserIds.length} (valid: ${validUserIds.length}, skipped/malformed: ${skipped}).`
  );

  if (validUserIds.length === 0) {
    console.log("Nothing to backfill.");
    await disconnectFromDatabase();
    return;
  }

  // Raw driver collection (bypasses Mongoose schema casting), so `_id` is
  // typed as a plain `ObjectId` — but stored `_id`s here are a mix of
  // ObjectId and Better Auth UUID strings (see src/lib/api/user-id.ts), so
  // the filter values need an `as any` escape hatch, matching the pattern
  // used elsewhere for raw driver queries against dual-format `_id`s (e.g.
  // verify-id-token/route.ts, password-account.ts).
  const idQueryValues = toUserIdQueryMulti(validUserIds);

  const matchedUserDocs = await usersCollection.countDocuments({
    _id: { $in: idQueryValues },
  } as any);

  const result = await usersCollection.updateMany(
    {
      _id: { $in: idQueryValues },
      $or: [{ isEmailVerified: { $ne: true } }, { emailVerified: { $ne: true } }],
    } as any,
    { $set: { emailVerified: true, isEmailVerified: true } }
  );

  console.log("\n=== Backfill: OAuth email-verified flags ===");
  console.log(
    JSON.stringify(
      {
        oauthAccountRows: oauthAccounts.length,
        distinctUserIds: rawUserIds.length,
        skippedMalformedUserIds: skipped,
        matchedUserDocs,
        updatedCount: result.modifiedCount,
      },
      null,
      2
    )
  );

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
