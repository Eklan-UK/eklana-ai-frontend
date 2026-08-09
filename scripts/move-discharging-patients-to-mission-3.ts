/**
 * Move `discharging_patients` drills and prompt templates to Mission 3.
 *
 * Sets `learning_journey_part: 3` (drills) / `part: "3"` (prompt templates) where
 * the topic is `discharging_patients` and the part is not already 3.
 *
 * Safe by default: runs as a DRY RUN unless `--apply` is passed.
 *
 * Usage:
 *   npx tsx scripts/move-discharging-patients-to-mission-3.ts                # dry run (default)
 *   npx tsx scripts/move-discharging-patients-to-mission-3.ts --apply         # persist changes
 *   npx tsx scripts/move-discharging-patients-to-mission-3.ts --verbose       # per-document detail
 */
import "dotenv/config";
import { connectToDatabase } from "../src/lib/api/db";
import Drill from "../src/models/drill";
import PromptTemplate from "../src/models/promptTemplate";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

const TOPIC = "discharging_patients";
const TARGET_PART = 3;
const TARGET_PART_STR = String(TARGET_PART);

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

type DrillMigration = {
  id: string;
  title: string;
  beforePart: unknown;
};

type TemplateMigration = {
  id: string;
  drillType: string;
  beforePart: string;
};

function needsDrillMigration(drill: RawDrill): boolean {
  const topic = String(drill.learning_journey_topic ?? "").trim();
  if (topic !== TOPIC) return false;
  return drill.learning_journey_part !== TARGET_PART;
}

function needsTemplateMigration(template: RawPromptTemplate): boolean {
  const topic = String(template.topic ?? "").trim();
  if (topic !== TOPIC) return false;
  return String(template.part ?? "") !== TARGET_PART_STR;
}

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
    learning_journey_topic: TOPIC,
  })
    .select("_id title learning_journey_part learning_journey_topic")
    .lean()
    .exec()) as unknown as RawDrill[];

  const templates = (await PromptTemplate.find({
    topic: TOPIC,
  })
    .select("_id drillType part topic")
    .lean()
    .exec()) as unknown as RawPromptTemplate[];

  const drillMigrations: DrillMigration[] = drills
    .filter(needsDrillMigration)
    .map((drill) => ({
      id: String(drill._id),
      title: drill.title ?? "",
      beforePart: drill.learning_journey_part,
    }));

  const templateMigrations: TemplateMigration[] = templates
    .filter(needsTemplateMigration)
    .map((template) => ({
      id: String(template._id),
      drillType: template.drillType ?? "?",
      beforePart: String(template.part ?? ""),
    }));

  console.log(`Scanned ${drills.length} drill(s) with topic "${TOPIC}".`);
  console.log(`Scanned ${templates.length} prompt template(s) with topic "${TOPIC}".`);
  console.log(`Planned ${drillMigrations.length} drill update(s).`);
  console.log(`Planned ${templateMigrations.length} prompt template update(s).\n`);

  if (drillMigrations.length > 0) {
    console.log("─".repeat(80));
    console.log("DRILLS");
    console.log("─".repeat(80));
    for (const migration of drillMigrations) {
      console.log(
        `[${migration.id}] "${migration.title || "(untitled)"}"  ` +
          `part: ${JSON.stringify(migration.beforePart)} → ${TARGET_PART}  ` +
          `topic: "${TOPIC}"`,
      );
    }
    console.log();
  }

  if (templateMigrations.length > 0) {
    console.log("─".repeat(80));
    console.log("PROMPT TEMPLATES");
    console.log("─".repeat(80));
    for (const migration of templateMigrations) {
      console.log(
        `[${migration.id}] drillType=${migration.drillType}  ` +
          `part: "${migration.beforePart}" → "${TARGET_PART_STR}"  ` +
          `topic: "${TOPIC}"`,
      );
    }
    console.log();
  }

  if (!APPLY) {
    const total = drillMigrations.length + templateMigrations.length;
    console.log(
      total > 0
        ? `Dry run complete. Re-run with --apply to persist ${total} change(s).`
        : "Dry run complete. Nothing to migrate.",
    );
    process.exit(0);
  }

  if (drillMigrations.length === 0 && templateMigrations.length === 0) {
    console.log("Nothing to apply.");
    process.exit(0);
  }

  console.log("Applying migrations...\n");

  let drillsUpdated = 0;
  for (const migration of drillMigrations) {
    await Drill.updateOne(
      { _id: migration.id },
      { $set: { learning_journey_part: TARGET_PART } },
    );
    drillsUpdated++;
    if (VERBOSE) {
      console.log(`  ✅ Updated drill ${migration.id}`);
    }
  }

  let templatesUpdated = 0;
  let templatesSkipped = 0;
  for (const migration of templateMigrations) {
    const existing = await PromptTemplate.findOne({
      drillType: migration.drillType,
      part: TARGET_PART_STR,
      topic: TOPIC,
    }).lean();

    if (existing) {
      await PromptTemplate.deleteOne({ _id: migration.id });
      templatesSkipped++;
      if (VERBOSE) {
        console.log(
          `  ⏭️  Deleted legacy template ${migration.id} (target already exists for ${migration.drillType})`,
        );
      }
      continue;
    }

    await PromptTemplate.updateOne(
      { _id: migration.id },
      { $set: { part: TARGET_PART_STR } },
    );
    templatesUpdated++;
    if (VERBOSE) {
      console.log(`  ✅ Updated prompt template ${migration.id}`);
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
