/**
 * Swap Mission 4 and Mission 5 in persisted drill and prompt-template data.
 *
 * Reassigns by topic slug (not a blind part swap) so collisions are avoided:
 *   - Interview prep topics → learning_journey_part 4
 *   - Bonus scenario topics → learning_journey_part 5
 *
 * Also migrates legacy `interview_preparation` on old part 4 → `motivation_prep`
 * on new part 4.
 *
 * Safe by default: runs as a DRY RUN unless `--apply` is passed.
 *
 * Usage:
 *   npx tsx scripts/swap-mission-4-and-5.ts                # dry run (default)
 *   npx tsx scripts/swap-mission-4-and-5.ts --apply         # persist changes
 *   npx tsx scripts/swap-mission-4-and-5.ts --verbose       # per-document detail
 */
import "dotenv/config";
import { connectToDatabase } from "../src/lib/api/db";
import Drill from "../src/models/drill";
import PromptTemplate from "../src/models/promptTemplate";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

const INTERVIEW_PREP_TOPICS = [
  "motivation_prep",
  "technical_prep",
  "situation_judgement_prep",
  "mock_1",
  "mock_2",
  "mock_3",
  "mock_4",
  "mock_5",
] as const;

const BONUS_SCENARIO_TOPICS = [
  "phone_colleagues",
  "phone_other_departments",
  "phone_patient_families",
  "grammar",
] as const;

const LEGACY_INTERVIEW_TOPIC = "interview_preparation";
const TARGET_INTERVIEW_PART = 4;
const TARGET_BONUS_PART = 5;

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
  before: { part: unknown; topic: unknown };
  after: { part: number; topic: string };
};

type TemplateMigration = {
  id: string;
  drillType: string;
  before: { part: string; topic: string };
  after: { part: string; topic: string };
};

function targetPartForTopic(topic: string): number | null {
  if (topic === LEGACY_INTERVIEW_TOPIC) return TARGET_INTERVIEW_PART;
  if ((INTERVIEW_PREP_TOPICS as readonly string[]).includes(topic)) {
    return TARGET_INTERVIEW_PART;
  }
  if ((BONUS_SCENARIO_TOPICS as readonly string[]).includes(topic)) {
    return TARGET_BONUS_PART;
  }
  return null;
}

function targetTopicForDrill(topic: string): string {
  if (topic === LEGACY_INTERVIEW_TOPIC) return "motivation_prep";
  return topic;
}

function planDrillMigration(drill: RawDrill): DrillMigration | null {
  const topic = String(drill.learning_journey_topic ?? "").trim();
  if (!topic) return null;

  const targetPart = targetPartForTopic(topic);
  if (targetPart == null) return null;

  const targetTopic = targetTopicForDrill(topic);
  const currentPart = drill.learning_journey_part;

  if (currentPart === targetPart && topic === targetTopic) return null;

  return {
    id: String(drill._id),
    title: drill.title ?? "",
    before: { part: currentPart, topic },
    after: { part: targetPart, topic: targetTopic },
  };
}

function planTemplateMigration(template: RawPromptTemplate): TemplateMigration | null {
  const topic = String(template.topic ?? "").trim();
  if (!topic) return null;

  const targetPart = targetPartForTopic(topic);
  if (targetPart == null) return null;

  const targetTopic = targetTopicForDrill(topic);
  const currentPart = String(template.part ?? "");

  if (currentPart === String(targetPart) && topic === targetTopic) return null;

  return {
    id: String(template._id),
    drillType: template.drillType ?? "?",
    before: { part: currentPart, topic },
    after: { part: String(targetPart), topic: targetTopic },
  };
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

  const allTopics = [
    ...INTERVIEW_PREP_TOPICS,
    ...BONUS_SCENARIO_TOPICS,
    LEGACY_INTERVIEW_TOPIC,
  ];

  const drills = (await Drill.find({
    learning_journey_topic: { $in: allTopics },
  })
    .select("_id title learning_journey_part learning_journey_topic")
    .lean()
    .exec()) as unknown as RawDrill[];

  const templates = (await PromptTemplate.find({
    topic: { $in: allTopics },
  })
    .select("_id drillType part topic")
    .lean()
    .exec()) as unknown as RawPromptTemplate[];

  const drillMigrations = drills
    .map(planDrillMigration)
    .filter((m): m is DrillMigration => m != null);

  const templateMigrations = templates
    .map(planTemplateMigration)
    .filter((m): m is TemplateMigration => m != null);

  console.log(`Scanned ${drills.length} drill(s) with mission 4/5 topics.`);
  console.log(`Scanned ${templates.length} prompt template(s) with mission 4/5 topics.`);
  console.log(`Planned ${drillMigrations.length} drill update(s).`);
  console.log(`Planned ${templateMigrations.length} prompt template update(s).\n`);

  if (drillMigrations.length > 0) {
    console.log("─".repeat(80));
    console.log("DRILLS");
    console.log("─".repeat(80));
    for (const migration of drillMigrations) {
      console.log(
        `[${migration.id}] "${migration.title || "(untitled)"}"  ` +
          `part: ${JSON.stringify(migration.before.part)} → ${migration.after.part}  ` +
          `topic: "${migration.before.topic}" → "${migration.after.topic}"`,
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
          `part: "${migration.before.part}" → "${migration.after.part}"  ` +
          `topic: "${migration.before.topic}" → "${migration.after.topic}"`,
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
      {
        $set: {
          learning_journey_part: migration.after.part,
          learning_journey_topic: migration.after.topic,
        },
      },
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
      part: migration.after.part,
      topic: migration.after.topic,
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
      {
        $set: {
          part: migration.after.part,
          topic: migration.after.topic,
        },
      },
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
