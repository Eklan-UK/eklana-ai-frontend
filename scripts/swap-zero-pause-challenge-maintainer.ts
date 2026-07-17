/**
 * One-time Mongo flip: zeroPauseProducts `challenge` ↔ `maintainer`.
 * Leaves `mastery` unchanged. Date fields stay on the user.
 *
 * Required after deploying the Challenge/Maintainer pricing role correction
 * so existing assignments match:
 *   Challenge = legacy ~US$1.99 + start/end dates
 *   Maintainer = public US$20 / US$60 / $200, no dates
 *
 * The swap is an involution: if this script was already executed under the
 * incorrect (swapped) mapping, run dry-run then --execute once more to fix.
 *
 * Default is dry-run (counts + sample only). Pass --execute to write.
 *
 * Usage (from repo root, env in .env):
 *   npx tsx scripts/swap-zero-pause-challenge-maintainer.ts
 *   npx tsx scripts/swap-zero-pause-challenge-maintainer.ts --execute
 *   npm run migrate:swap-zero-pause-cohorts
 *   npm run migrate:swap-zero-pause-cohorts -- --execute
 *
 * Requires:
 *   MONGO_URI
 */
import "dotenv/config";
import { connectToDatabase } from "../src/lib/api/db";
import User from "../src/models/user";

type ZeroPauseProduct = "challenge" | "mastery" | "maintainer";

function swapChallengeMaintainer(
  products: ZeroPauseProduct[]
): ZeroPauseProduct[] {
  return products.map((p) => {
    if (p === "challenge") return "maintainer";
    if (p === "maintainer") return "challenge";
    return p;
  });
}

async function main() {
  const execute = process.argv.includes("--execute");

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  await connectToDatabase();

  const filter = {
    zeroPauseProducts: { $in: ["challenge", "maintainer"] },
  };

  const users = await User.find(filter)
    .select("_id email zeroPauseProducts zeroPauseDate zeroPauseEndDate")
    .lean()
    .exec();

  let both = 0;
  let challengeOnly = 0;
  let maintainerOnly = 0;
  let withMastery = 0;

  for (const u of users) {
    const products = (u.zeroPauseProducts ?? []) as ZeroPauseProduct[];
    const hasC = products.includes("challenge");
    const hasM = products.includes("maintainer");
    if (hasC && hasM) both++;
    else if (hasC) challengeOnly++;
    else if (hasM) maintainerOnly++;
    if (products.includes("mastery")) withMastery++;
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        matched: users.length,
        challengeOnly,
        maintainerOnly,
        bothChallengeAndMaintainer: both,
        alsoHasMastery: withMastery,
        sample: users.slice(0, 10).map((u) => ({
          userId: String(u._id),
          email: u.email,
          before: u.zeroPauseProducts,
          after: swapChallengeMaintainer(
            (u.zeroPauseProducts ?? []) as ZeroPauseProduct[]
          ),
        })),
      },
      null,
      2
    )
  );

  if (!execute) {
    console.log(
      "\nDry-run only. Re-run with --execute to apply challenge ↔ maintainer swaps."
    );
    process.exit(0);
  }

  let updated = 0;
  for (const u of users) {
    const before = (u.zeroPauseProducts ?? []) as ZeroPauseProduct[];
    const after = swapChallengeMaintainer(before);
    // Skip no-ops (shouldn't happen given filter, but safe).
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    await User.updateOne(
      { _id: u._id },
      { $set: { zeroPauseProducts: after } }
    ).exec();
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        updated,
        matched: users.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
