/**
 * Verifies the `User._id` custom SchemaType fix (src/models/user.ts).
 *
 * Root cause being verified: with `_id: Schema.Types.Mixed`, Mongoose's
 * `castForQuery` was a no-op, so `User.findById("<24-char hex string>")`
 * built the filter `{ _id: "<hex string>" }` (a JS string) which does NOT
 * match legacy documents whose `_id` is a real BSON ObjectId. The fix
 * replaces `Mixed` with a custom SchemaType that casts ObjectId-shaped
 * values to `Types.ObjectId` for both documents and queries.
 *
 * This script:
 *   1. Finds (or creates, clearly logged) a legacy ObjectId-keyed user with
 *      subscriptionPlan "premium" and a future subscriptionExpiresAt.
 *   2. Confirms `User.findById(user._id.toString())` — called with the
 *      STRING form, exactly like production `withPremium`/
 *      `/api/v1/users/current` do — returns the document.
 *   3. Confirms `isUserSubscribed()` evaluates to `true` for that user.
 *   4. Confirms a UUID-keyed user still round-trips correctly (no regression).
 *   5. Confirms `User.find({ _id: { $in: [...] } })` works for a mix of
 *      ObjectId + UUID ids (used by user.service.ts findMultipleWithRole).
 *   6. Cleans up any temporary user this script created.
 *
 * Usage:
 *   npx tsx scripts/verify-user-id-cast-fix.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";
import { isUserSubscribed } from "../src/lib/api/user-subscription";

function pass(label: string, ok: boolean, extra?: unknown) {
  const icon = ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${label}`, extra !== undefined ? extra : "");
  if (!ok) process.exitCode = 1;
}

async function main() {
  await connectToDatabase();

  const createdIds: mongoose.Types.ObjectId[] = [];

  try {
    // ── 1. Legacy ObjectId-keyed premium user ────────────────────────────
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let legacyUser = await User.findOne({
      subscriptionPlan: "premium",
      subscriptionExpiresAt: { $gt: new Date() },
    })
      .lean()
      .exec();

    // Only usable if its _id is a real BSON ObjectId (not a UUID string).
    if (legacyUser && !(legacyUser._id instanceof Types.ObjectId)) {
      legacyUser = null;
    }

    let createdTempUser = false;
    if (!legacyUser) {
      console.log(
        "\nNo existing legacy ObjectId premium user found — creating a temporary one for verification."
      );
      const tempEmail = `verify-userid-fix-${Date.now()}@example.invalid`;
      const created = await User.create({
        firstName: "Verify",
        lastName: "TempUser",
        email: tempEmail,
        role: "user",
        subscriptionPlan: "premium",
        subscriptionPaymentMethod: "manual",
        subscriptionExpiresAt: future,
        subscriptionActivatedAt: new Date(),
      });
      createdTempUser = true;
      createdIds.push(created._id as Types.ObjectId);
      console.log(
        `Created temp user _id=${created._id} email=${tempEmail} (will be deleted at end of script).`
      );
      legacyUser = await User.findById(created._id).lean().exec();
    }

    if (!legacyUser) {
      throw new Error("Could not obtain a legacy ObjectId premium user to test with.");
    }

    const legacyIdString = String(legacyUser._id);
    console.log(`\nUsing legacy user _id=${legacyIdString} (source: ${createdTempUser ? "temp" : "existing DB"})`);
    pass(
      "legacy user _id is a real BSON ObjectId (not UUID)",
      legacyUser._id instanceof Types.ObjectId
    );

    // ── 2. The exact broken call pattern: findById with the STRING form ──
    const foundByString = await User.findById(legacyIdString).lean().exec();
    pass(
      "User.findById(<hex string>) finds the legacy ObjectId user",
      !!foundByString && String(foundByString._id) === legacyIdString,
      { found: !!foundByString }
    );

    // ── 3. isUserSubscribed() matches what withPremium / users/current use ──
    const subscribed = foundByString ? isUserSubscribed(foundByString as any) : false;
    pass("isUserSubscribed() is true for the legacy premium user", subscribed === true, {
      subscriptionPlan: foundByString?.subscriptionPlan,
      subscriptionExpiresAt: foundByString?.subscriptionExpiresAt,
      subscriptionPaymentMethod: (foundByString as any)?.subscriptionPaymentMethod,
    });

    // Also confirm findOne({ _id: <string> }) — used in a few call sites —
    // and the raw filter path behave consistently.
    const foundByFindOne = await User.findOne({ _id: legacyIdString }).lean().exec();
    pass(
      "User.findOne({ _id: <hex string> }) finds the legacy ObjectId user",
      !!foundByFindOne && String(foundByFindOne._id) === legacyIdString
    );

    // ── 4. UUID-keyed user still round-trips (no regression) ────────────
    let uuidUser = await User.findOne({
      _id: { $type: "string" },
    })
      .lean()
      .exec();

    let createdTempUuidUser: string | null = null;
    if (!uuidUser) {
      console.log(
        "\n[SKIP] No existing UUID-keyed user found in the DB — creating a temporary one to verify no regression."
      );
      const tempUuid = randomUUID();
      const tempEmail = `verify-uuid-fix-${Date.now()}@example.invalid`;
      await User.create({
        _id: tempUuid,
        firstName: "Verify",
        lastName: "UuidTempUser",
        email: tempEmail,
        role: "user",
      });
      createdTempUuidUser = tempUuid;
      console.log(`Created temp UUID user _id=${tempUuid} email=${tempEmail} (will be deleted at end of script).`);
      uuidUser = await User.findById(tempUuid).lean().exec();
    }

    if (!uuidUser) {
      throw new Error("Could not obtain a UUID-keyed user to test with.");
    }

    const uuidId = String(uuidUser._id);
    const foundUuid = await User.findById(uuidId).lean().exec();
    pass(
      `User.findById(<uuid string>) finds UUID user (_id=${uuidId}, source: ${createdTempUuidUser ? "temp" : "existing DB"})`,
      !!foundUuid && String(foundUuid._id) === uuidId
    );

    // ── 5. $in query mixing ObjectId + UUID ids (findMultipleWithRole) ──
    const mixedIds: string[] = [legacyIdString, uuidId];
    const mixedResults = await User.find({ _id: { $in: mixedIds } })
      .select("_id")
      .lean()
      .exec();
    pass(
      `User.find({ _id: { $in: [ObjectId, UUID] } }) returns both requested ids`,
      mixedResults.length === mixedIds.length,
      { requested: mixedIds.length, found: mixedResults.length }
    );

    if (createdTempUuidUser) {
      await User.deleteOne({ _id: createdTempUuidUser }).exec();
      console.log(`\nCleaned up temp UUID user _id=${createdTempUuidUser}.`);
    }
  } finally {
    // ── Cleanup any temp user(s) this script created ─────────────────────
    for (const id of createdIds) {
      await User.deleteOne({ _id: id }).exec();
      console.log(`\nCleaned up temp user _id=${id}.`);
    }
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
