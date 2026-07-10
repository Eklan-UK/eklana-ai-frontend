/**
 * @deprecated Use `scripts/swap-mission-4-and-5.ts` instead — Interview Preparation
 * is now Mission 4. This script remains for one-off legacy rows that still have
 * topic `interview_preparation` on part 4 before the full swap migration runs.
 *
 * Migrate legacy Interview Preparation drills and prompt templates from
 * topic `interview_preparation` to Mission 4 / topic `motivation_prep`.
 *
 * Safe by default: runs as a DRY RUN unless `--apply` is passed.
 *
 * Usage:
 *   npx tsx scripts/migrate-interview-prep-to-mission-5.ts                # dry run (default)
 *   npx tsx scripts/migrate-interview-prep-to-mission-5.ts --apply         # persist changes
 *   npx tsx scripts/migrate-interview-prep-to-mission-5.ts --verbose       # per-document detail
 *
 * Prefer:
 *   npx tsx scripts/swap-mission-4-and-5.ts
 */
import "dotenv/config";
import { connectToDatabase } from "../src/lib/api/db";
import Drill from "../src/models/drill";
import PromptTemplate from "../src/models/promptTemplate";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

const LEGACY_TOPIC = "interview_preparation";
const TARGET_PART = 4;
const TARGET_TOPIC = "motivation_prep";

type RawDrill = {
  _id: unknown;
  title?: string;
  learning_journey_part?: unknown;
  learning_journey_topic?: unknown;
};

type RawPromptTemplate = {
  _id: unknown;
  drillType?: string;
  part?: string;
  topic?: string;
};

async function main() {
  console.log("Connecting to database...");
  await connectToDatabase();
  console.log("Connected.\n");
  console.log(
    APPLY
      ? "⚠️  APPLY MODE — changes will be written\n"
      : "🔎 DRY RUN — no changes will be written (pass --apply to persist)\n",
  );

  const drills = (await Drill.find({
    learning_journey_topic: LEGACY_TOPIC,
  })
    .select("_id title learning_journey_part learning_journey_topic")
    .lean()
    .exec()) as unknown as RawDrill[];

  const templates = (await PromptTemplate.find({
    topic: LEGACY_TOPIC,
  })
    .select("_id drillType part topic")
    .lean()
    .exec()) as unknown as RawPromptTemplate[];

  console.log(`Found ${drills.length} drill(s) to migrate.`);
  console.log(`Found ${templates.length} prompt template(s) to migrate.\n`);

  if (drills.length > 0) {
    console.log("─".repeat(80));
    console.log("DRILLS");
    console.log("─".repeat(80));
    for (const drill of drills) {
      console.log(
        `[${String(drill._id)}] "${drill.title || "(untitled)"}"  ` +
          `part: ${String(drill.learning_journey_part ?? "?")} → ${TARGET_PART}  ` +
          `topic: "${LEGACY_TOPIC}" → "${TARGET_TOPIC}"`,
      );
    }
    console.log();
  }

  if (templates.length > 0) {
    console.log("─".repeat(80));
    console.log("PROMPT TEMPLATES");
    console.log("─".repeat(80));
    for (const template of templates) {
      console.log(
        `[${String(template._id)}] drillType=${template.drillType ?? "?"}  ` +
          `part: "${template.part ?? "?"}" → "${TARGET_PART}"  ` +
          `topic: "${LEGACY_TOPIC}" → "${TARGET_TOPIC}"`,
      );
    }
    console.log();
  }

  if (!APPLY) {
    const total = drills.length + templates.length;
    console.log(
      total > 0
        ? `Dry run complete. Re-run with --apply to persist ${total} change(s).`
        : "Dry run complete. Nothing to migrate.",
    );
    process.exit(0);
  }

  if (drills.length === 0 && templates.length === 0) {
    console.log("Nothing to apply.");
    process.exit(0);
  }

  console.log("Applying migrations...\n");

  let drillsUpdated = 0;
  for (const drill of drills) {
    await Drill.updateOne(
      { _id: drill._id },
      {
        $set: {
          learning_journey_part: TARGET_PART,
          learning_journey_topic: TARGET_TOPIC,
        },
      },
    );
    drillsUpdated++;
    if (VERBOSE) {
      console.log(`  ✅ Updated drill ${String(drill._id)}`);
    }
  }

  let templatesUpdated = 0;
  let templatesSkipped = 0;
  for (const template of templates) {
    const existing = await PromptTemplate.findOne({
      drillType: template.drillType,
      part: String(TARGET_PART),
      topic: TARGET_TOPIC,
    }).lean();

    if (existing) {
      await PromptTemplate.deleteOne({ _id: template._id });
      templatesSkipped++;
      if (VERBOSE) {
        console.log(
          `  ⏭️  Deleted legacy template ${String(template._id)} (target already exists for ${template.drillType})`,
        );
      }
      continue;
    }

    await PromptTemplate.updateOne(
      { _id: template._id },
      {
        $set: {
          part: String(TARGET_PART),
          topic: TARGET_TOPIC,
        },
      },
    );
    templatesUpdated++;
    if (VERBOSE) {
      console.log(`  ✅ Updated prompt template ${String(template._id)}`);
    }
  }

  console.log(
    `\n✅ Applied ${drillsUpdated} drill update(s), ${templatesUpdated} template update(s)` +
      (templatesSkipped > 0
        ? `, ${templatesSkipped} duplicate template(s) removed`
        : "") +
      ".",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
