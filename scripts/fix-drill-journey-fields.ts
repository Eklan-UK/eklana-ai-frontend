/**
 * Repair `learning_journey_part` / `learning_journey_topic` fields on existing
 * Drill documents that were corrupted by a bug in the AI/manual drill builder's
 * bulk-assign payload, which used to send *display labels* instead of the raw
 * catalog ids:
 *   - learning_journey_part  -> was sometimes a label like "Mission 1: Communication
 *     with Patients" instead of the numeric id (1-4). The Drill schema types this
 *     field as Number, so a label string actually fails Mongoose's cast/validation
 *     and the whole document fails to save — meaning in practice this field should
 *     already be clean in the DB. This script still checks for it defensively.
 *   - learning_journey_topic -> was sometimes the topic *title* (e.g. "Handling
 *     Emergency/Critical Situation") instead of the topic id slug (e.g.
 *     "handling_emergency_critical"). This field is a plain String in the schema,
 *     so it saves happily even when wrong — this is the corruption actually found
 *     in production data.
 *
 * This script:
 *   1. Finds all drills whose learning_journey_part/learning_journey_topic do not
 *      match a known catalog id, and tries to reverse-map them back to the correct
 *      id using the labels defined in `learning-journey.catalog.ts`.
 *   2. Reports (but does NOT touch) drills with completely missing part/topic —
 *      there's no reliable signal to infer what mission/topic they should belong
 *      to, so those need manual triage (or are legitimately pre-dating the
 *      learning-journey feature and don't need any mission/topic).
 *   3. Reports (but does NOT touch) drills where the part+topic combination can't
 *      be resolved to a valid pair from the catalog, so a human can decide.
 *
 * Safe by default: runs as a DRY RUN unless `--apply` is passed, in which case no
 * writes happen — only a report is printed.
 *
 * Usage:
 *   npx tsx scripts/fix-drill-journey-fields.ts                # dry run (default)
 *   npx tsx scripts/fix-drill-journey-fields.ts --apply         # actually persist fixes
 *   npx tsx scripts/fix-drill-journey-fields.ts --verbose       # print per-drill detail
 */
import "dotenv/config";
import { connectToDatabase } from "../src/lib/api/db";
import Drill from "../src/models/drill";
import {
  LEARNING_JOURNEY_PARTS,
  getMissionNumberLabel,
  getPartLabel,
  getTopicById,
  isKnownLearningJourneyTopicId,
  isLearningJourneyPartId,
  isValidPartTopicPair,
  type LearningJourneyPartId,
} from "../src/domain/learning-journey/learning-journey.catalog";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

// Reverse map: any label a "part" field might have been mangled into -> numeric part id.
// Covers `getPartLabel` ("Mission 1: Communication with Patients"), the bare
// `getMissionNumberLabel` ("Mission 1"), and the raw part title on its own.
const partLabelToId = new Map<string, LearningJourneyPartId>();
for (const part of LEARNING_JOURNEY_PARTS) {
  partLabelToId.set(normalize(getPartLabel(part.part)), part.part);
  partLabelToId.set(normalize(getMissionNumberLabel(part.part)), part.part);
  partLabelToId.set(normalize(part.title), part.part);
  partLabelToId.set(normalize(part.part), part.part);
  partLabelToId.set(normalize(String(part.part)), part.part);
}

// Reverse map: topic title -> topic id slug.
const topicTitleToId = new Map<string, string>();
for (const part of LEARNING_JOURNEY_PARTS) {
  for (const topic of part.topics) {
    topicTitleToId.set(normalize(topic.title), topic.id);
  }
}

type RawDrill = {
  _id: unknown;
  title?: string;
  learning_journey_part?: unknown;
  learning_journey_topic?: unknown;
};

type PlannedFix = {
  id: string;
  title: string;
  before: { part: unknown; topic: unknown };
  after: { part: LearningJourneyPartId; topic: string };
};

type UnresolvedDrill = {
  id: string;
  title: string;
  part: unknown;
  topic: unknown;
  reason: string;
};

async function main() {
  console.log("Connecting to database...");
  await connectToDatabase();
  console.log("Connected.\n");
  console.log(APPLY ? "⚠️  APPLY MODE — changes will be written\n" : "🔎 DRY RUN — no changes will be written (pass --apply to persist)\n");

  const drills = (await Drill.find({})
    .select("_id title learning_journey_part learning_journey_topic")
    .lean()
    .exec()) as unknown as RawDrill[];

  console.log(`Scanned ${drills.length} drills total.\n`);

  const fixes: PlannedFix[] = [];
  const unresolved: UnresolvedDrill[] = [];
  const missing: RawDrill[] = [];
  let alreadyValid = 0;

  for (const drill of drills) {
    const rawPart = drill.learning_journey_part;
    const rawTopic = drill.learning_journey_topic;

    const partIsEmpty = rawPart == null || rawPart === ("" as unknown);
    const topicIsEmpty = rawTopic == null || rawTopic === "";

    if (partIsEmpty && topicIsEmpty) {
      missing.push(drill);
      continue;
    }

    const partAlreadyValid = isLearningJourneyPartId(rawPart);
    const topicAlreadyValid =
      typeof rawTopic === "string" && isKnownLearningJourneyTopicId(rawTopic);

    if (partAlreadyValid && topicAlreadyValid) {
      if (isValidPartTopicPair(rawPart as LearningJourneyPartId, rawTopic as string)) {
        alreadyValid++;
        continue;
      }
      unresolved.push({
        id: String(drill._id),
        title: drill.title ?? "",
        part: rawPart,
        topic: rawTopic,
        reason: "Part and topic are individually valid ids but don't belong together",
      });
      continue;
    }

    // Try to recover a valid topic id from a mangled title.
    let resolvedTopic: string | undefined = topicAlreadyValid
      ? (rawTopic as string)
      : topicTitleToId.get(normalize(rawTopic));

    // Try to recover a valid part id from a mangled label.
    let resolvedPart: LearningJourneyPartId | undefined = partAlreadyValid
      ? (rawPart as LearningJourneyPartId)
      : partLabelToId.get(normalize(rawPart));

    // If we recovered the topic but not the part, infer the part from the topic's
    // owning mission in the catalog (each topic belongs to exactly one part).
    if (resolvedTopic && !resolvedPart) {
      resolvedPart = getTopicById(resolvedTopic)?.part;
    }

    if (!resolvedPart || !resolvedTopic) {
      unresolved.push({
        id: String(drill._id),
        title: drill.title ?? "",
        part: rawPart,
        topic: rawTopic,
        reason: !resolvedPart
          ? `Could not map part value ${JSON.stringify(rawPart)} to a known mission`
          : `Could not map topic value ${JSON.stringify(rawTopic)} to a known topic`,
      });
      continue;
    }

    if (!isValidPartTopicPair(resolvedPart, resolvedTopic)) {
      unresolved.push({
        id: String(drill._id),
        title: drill.title ?? "",
        part: rawPart,
        topic: rawTopic,
        reason: `Resolved pair (part=${resolvedPart}, topic=${resolvedTopic}) is not a valid combination`,
      });
      continue;
    }

    if (resolvedPart === rawPart && resolvedTopic === rawTopic) {
      // Nothing actually changed (shouldn't normally happen given the checks above).
      alreadyValid++;
      continue;
    }

    fixes.push({
      id: String(drill._id),
      title: drill.title ?? "",
      before: { part: rawPart, topic: rawTopic },
      after: { part: resolvedPart, topic: resolvedTopic },
    });
  }

  console.log(`✅ Already valid:        ${alreadyValid}`);
  console.log(`🛠️  Fixable (label→id):   ${fixes.length}`);
  console.log(`❓ Unresolved/mismatched: ${unresolved.length}`);
  console.log(`⬜ Missing part+topic:    ${missing.length} (left untouched — no reliable source to infer these)\n`);

  if (fixes.length > 0) {
    console.log("─".repeat(80));
    console.log("FIXABLE DRILLS");
    console.log("─".repeat(80));
    for (const fix of fixes) {
      console.log(
        `[${fix.id}] "${fix.title || "(untitled)"}"  ` +
          `part: ${JSON.stringify(fix.before.part)} → ${fix.after.part}  ` +
          `topic: ${JSON.stringify(fix.before.topic)} → "${fix.after.topic}"`,
      );
    }
    console.log();
  }

  if (unresolved.length > 0) {
    console.log("─".repeat(80));
    console.log("UNRESOLVED / MISMATCHED DRILLS (needs manual review)");
    console.log("─".repeat(80));
    for (const item of unresolved) {
      console.log(
        `[${item.id}] "${item.title || "(untitled)"}"  ` +
          `part=${JSON.stringify(item.part)} topic=${JSON.stringify(item.topic)}  — ${item.reason}`,
      );
    }
    console.log();
  }

  if (VERBOSE && missing.length > 0) {
    console.log("─".repeat(80));
    console.log("DRILLS WITH NO PART/TOPIC (informational only)");
    console.log("─".repeat(80));
    for (const drill of missing) {
      console.log(`[${String(drill._id)}] "${drill.title || "(untitled)"}"`);
    }
    console.log();
  }

  if (!APPLY) {
    console.log(
      fixes.length > 0
        ? `Dry run complete. Re-run with --apply to persist ${fixes.length} fix(es).`
        : "Dry run complete. No fixable drills found.",
    );
    process.exit(0);
  }

  if (fixes.length === 0) {
    console.log("Nothing to apply.");
    process.exit(0);
  }

  console.log(`Applying ${fixes.length} fix(es)...`);
  let updated = 0;
  for (const fix of fixes) {
    await Drill.updateOne(
      { _id: fix.id },
      {
        $set: {
          learning_journey_part: fix.after.part,
          learning_journey_topic: fix.after.topic,
        },
      },
    );
    updated++;
    if (VERBOSE) console.log(`  ✅ Updated ${fix.id}`);
  }
  console.log(`\n✅ Applied ${updated} fix(es).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
