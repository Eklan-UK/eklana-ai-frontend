// Delete DrillAttempt, DrillAssignment, Bookmark, PronunciationAttempt records whose
// drillId no longer exists, and strip matching entries from WordAnalytics.scoreHistory.
//
// Run with: npx tsx scripts/cleanup-orphaned-drill-data.ts --dry-run   (preview, default)
//           npx tsx scripts/cleanup-orphaned-drill-data.ts              (execute)

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../src/lib/api/db';
import Drill from '../src/models/drill';
import DrillAttempt from '../src/models/drill-attempt';
import DrillAssignment from '../src/models/drill-assignment';
import Bookmark from '../src/models/bookmark';
import PronunciationAttempt from '../src/models/pronunciation-attempt';
import WordAnalytics from '../src/models/word-analytics';

const DRY_RUN = !process.argv.includes('--execute');

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --execute to delete)' : 'EXECUTE — will delete data'}\n`);
  console.log('Connecting to database...');
  await connectToDatabase();
  console.log('Connected.\n');

  // ── 1. Collect all drill IDs that still exist ──────────────────────────────
  const existingDrillIds = new Set(
    (await Drill.find({}).select('_id').lean().exec()).map((d) => d._id.toString())
  );
  console.log(`Total drills in DB: ${existingDrillIds.size}`);

  // ── 2. Find orphaned DrillAttempts ─────────────────────────────────────────
  const allAttempts = await DrillAttempt.find({})
    .select('_id drillId learnerId completedAt')
    .lean()
    .exec();

  const orphanedAttempts = allAttempts.filter(
    (a) => !existingDrillIds.has(a.drillId?.toString())
  );

  console.log(`\nDrillAttempts total:    ${allAttempts.length}`);
  console.log(`Orphaned attempts:      ${orphanedAttempts.length}`);

  if (orphanedAttempts.length > 0) {
    const byDrillId: Record<string, typeof orphanedAttempts> = {};
    orphanedAttempts.forEach((a) => {
      const key = a.drillId?.toString() ?? 'null';
      if (!byDrillId[key]) byDrillId[key] = [];
      byDrillId[key].push(a);
    });
    console.log('\nOrphaned attempts grouped by missing drillId:');
    Object.entries(byDrillId)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([drillId, attempts]) => {
        console.log(`  drillId ${drillId}  →  ${attempts.length} attempt(s)`);
        attempts.slice(0, 3).forEach((a) => {
          console.log(`    _id: ${a._id}  learnerId: ${a.learnerId}  completedAt: ${a.completedAt ?? 'n/a'}`);
        });
        if (attempts.length > 3) console.log(`    ... and ${attempts.length - 3} more`);
      });
  }

  // ── 3. Find orphaned DrillAssignments ──────────────────────────────────────
  const allAssignments = await DrillAssignment.find({})
    .select('_id drillId learnerId status')
    .lean()
    .exec();

  const orphanedAssignments = allAssignments.filter(
    (a) => !existingDrillIds.has((a as any).drillId?.toString())
  );

  console.log(`\nDrillAssignments total: ${allAssignments.length}`);
  console.log(`Orphaned assignments:   ${orphanedAssignments.length}`);

  if (orphanedAssignments.length > 0) {
    const byDrillId: Record<string, typeof orphanedAssignments> = {};
    orphanedAssignments.forEach((a) => {
      const key = (a as any).drillId?.toString() ?? 'null';
      if (!byDrillId[key]) byDrillId[key] = [];
      byDrillId[key].push(a);
    });
    console.log('\nOrphaned assignments grouped by missing drillId:');
    Object.entries(byDrillId)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([drillId, assignments]) => {
        console.log(`  drillId ${drillId}  →  ${assignments.length} assignment(s)  (statuses: ${[...new Set(assignments.map((a: any) => a.status))].join(', ')})`);
      });
  }

  // ── 4. Collect unique orphaned drillIds for related-model cleanup ──────────
  const orphanedDrillIdStrings = new Set([
    ...orphanedAttempts.map((a) => a.drillId?.toString()).filter(Boolean),
    ...orphanedAssignments.map((a: any) => a.drillId?.toString()).filter(Boolean),
  ]) as Set<string>;

  const orphanedDrillObjectIds = [...orphanedDrillIdStrings].map(
    (id) => new Types.ObjectId(id)
  );

  console.log(`\nUnique orphaned drillIds: ${orphanedDrillObjectIds.length}`);

  if (DRY_RUN) {
    console.log('\n── DRY RUN COMPLETE ──────────────────────────────────────────────────────');
    console.log('No data was modified. Run with --execute to delete the above records.');
    await disconnectFromDatabase();
    process.exit(0);
  }

  // ── 5. Delete orphaned data (mirrors cascadeDeleteLearnerData) ─────────────
  console.log('\nDeleting orphaned records...');

  if (orphanedAttempts.length > 0) {
    const attemptIds = orphanedAttempts.map((a) => a._id);
    const result = await DrillAttempt.deleteMany({ _id: { $in: attemptIds } }).exec();
    console.log(`  DrillAttempt deleted:          ${result.deletedCount}`);
  } else {
    console.log('  DrillAttempt deleted:          0 (none found)');
  }

  if (orphanedAssignments.length > 0) {
    const assignmentIds = orphanedAssignments.map((a) => a._id);
    const result = await DrillAssignment.deleteMany({ _id: { $in: assignmentIds } }).exec();
    console.log(`  DrillAssignment deleted:       ${result.deletedCount}`);
  } else {
    console.log('  DrillAssignment deleted:       0 (none found)');
  }

  if (orphanedDrillObjectIds.length > 0) {
    const bookmarkResult = await Bookmark.deleteMany({
      drillId: { $in: orphanedDrillObjectIds },
    }).exec();
    console.log(`  Bookmark deleted:              ${bookmarkResult.deletedCount}`);

    const pronunciationResult = await PronunciationAttempt.deleteMany({
      drillId: { $in: orphanedDrillObjectIds },
    }).exec();
    console.log(`  PronunciationAttempt deleted:  ${pronunciationResult.deletedCount}`);

    const wordAnalyticsResult = await WordAnalytics.updateMany(
      { 'scoreHistory.drillId': { $in: orphanedDrillObjectIds } },
      { $pull: { scoreHistory: { drillId: { $in: orphanedDrillObjectIds } } } }
    ).exec();
    console.log(`  WordAnalytics docs updated:    ${wordAnalyticsResult.modifiedCount}`);
  } else {
    console.log('  Bookmark / PronunciationAttempt / WordAnalytics: nothing to clean');
  }

  console.log('\n── CLEANUP COMPLETE ──────────────────────────────────────────────────────');
  await disconnectFromDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
