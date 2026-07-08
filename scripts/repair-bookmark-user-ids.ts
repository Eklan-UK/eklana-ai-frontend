/**
 * Repair legacy Bookmark documents whose userId was stored as a raw 24-char
 * hex string instead of a BSON ObjectId. After the bookmark route fix, new
 * writes use toUserIdQuery(); this script normalizes existing rows.
 *
 * Usage (dry-run by default — no changes made):
 *   npx tsx scripts/repair-bookmark-user-ids.ts
 *
 * Apply changes:
 *   npx tsx scripts/repair-bookmark-user-ids.ts --apply
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/lib/api/db";
import Bookmark from "../src/models/bookmark";
import { isObjectId } from "../src/lib/api/user-id";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const dryRun = !hasFlag("--apply");

async function main() {
  console.log(
    `\nMode: ${dryRun ? "DRY RUN (no changes — pass --apply to apply)" : "APPLY (making changes)"}`,
  );

  await connectToDatabase();

  const cursor = Bookmark.collection.find({
    userId: { $type: "string" },
  });

  let scanned = 0;
  let repaired = 0;
  let skipped = 0;

  for await (const row of cursor) {
    scanned += 1;
    const userId = row.userId;
    if (typeof userId !== "string" || !isObjectId(userId)) {
      skipped += 1;
      continue;
    }

    const objectId = new Types.ObjectId(userId);
    if (dryRun) {
      console.log(`Would repair bookmark ${row._id}: userId "${userId}" -> ObjectId(${objectId})`);
    } else {
      await Bookmark.collection.updateOne(
        { _id: row._id },
        { $set: { userId: objectId } },
      );
      console.log(`Repaired bookmark ${row._id}: userId "${userId}" -> ObjectId(${objectId})`);
    }
    repaired += 1;
  }

  console.log("\nSummary:");
  console.log(`  scanned string userIds: ${scanned}`);
  console.log(`  ${dryRun ? "would repair" : "repaired"}: ${repaired}`);
  console.log(`  skipped (non-ObjectId strings): ${skipped}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
