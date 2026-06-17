// Find drills with missing or "Untitled" titles, and orphaned drill attempts/submissions.
// Run with: npx tsx scripts/find-untitled-drills.ts
// Add --all to include drills from all roles (not just admin).
// Add --show-admin-drills to list all admin drills (helps spot short/suspicious titles).
// Add --orphans to find attempts/assignments referencing deleted drills (root cause of "Untitled Drill" in UI).

import { connectToDatabase } from '../src/lib/api/db';
import Drill from '../src/models/drill';
import DrillAttempt from '../src/models/drill-attempt';
import DrillAssignment from '../src/models/drill-assignment';
import User from '../src/models/user';

const SHOW_ALL = process.argv.includes('--all');
const SHOW_ADMIN_DRILLS = process.argv.includes('--show-admin-drills');
const CHECK_ORPHANS = process.argv.includes('--orphans');

async function findUntitledDrills() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    console.log('Connected.\n');

    // Fetch all admins so we can cross-reference by email or createdById
    const admins = await User.find({ role: 'admin' })
      .select('_id email firstName lastName')
      .lean()
      .exec();

    const adminIds = new Set(admins.map((a) => a._id.toString()));
    const adminEmails = new Set(admins.map((a) => a.email));

    console.log(`Found ${admins.length} admin account(s).`);
    admins.forEach((a) => console.log(`  • ${a.email}  (${a._id})`));

    // If requested, dump all admin drills so the user can spot suspicious titles
    if (SHOW_ADMIN_DRILLS) {
      const adminDrillsAll = await Drill.find({
        $or: [
          { createdById: { $in: [...adminIds] } },
          { created_by: { $in: [...adminEmails] } },
        ],
      })
        .select('_id title type is_active totalAssignments created_date')
        .sort({ created_date: -1 })
        .lean()
        .exec();

      console.log(`\n--- ALL ADMIN DRILLS (${adminDrillsAll.length}) ---`);
      adminDrillsAll.forEach((d, i) => {
        const date = d.created_date
          ? new Date(d.created_date as string).toISOString().split('T')[0]
          : '?';
        console.log(
          `  [${String(i + 1).padStart(3)}] ${d._id}  "${d.title ?? '(null)'}"  type=${d.type}  active=${d.is_active}  assignments=${d.totalAssignments ?? 0}  created=${date}`
        );
      });
    }

    // Match drills whose title is blank, missing, whitespace-only, or starts with "Untitled"
    const query: Record<string, unknown> = {
      $or: [
        { title: { $exists: false } },
        { title: null },
        { title: '' },
        { title: /^\s*$/ },          // whitespace-only
        { title: /^untitled/i },
      ],
    };

    const drills = await Drill.find(query)
      .select(
        '_id title type difficulty date is_active totalAssignments created_date createdById created_by assigned_to context'
      )
      .sort({ created_date: -1 })
      .lean()
      .exec();

    console.log(`\nTotal drills matching "untitled / blank" title: ${drills.length}`);

    // Separate by creator role
    const adminDrills = drills.filter((d) => {
      const byId  = d.createdById && adminIds.has(d.createdById.toString());
      const byEmail = d.created_by && adminEmails.has(d.created_by as string);
      return byId || byEmail;
    });

    const otherDrills = drills.filter((d) => {
      const byId  = d.createdById && adminIds.has(d.createdById.toString());
      const byEmail = d.created_by && adminEmails.has(d.created_by as string);
      return !byId && !byEmail;
    });

    console.log(`  → Created by admin:       ${adminDrills.length}`);
    console.log(`  → Created by other roles: ${otherDrills.length}`);

    const toShow = SHOW_ALL ? drills : adminDrills;

    if (toShow.length === 0) {
      console.log('\nNo untitled drills found' + (SHOW_ALL ? '' : ' for admin users') + '.');
      if (!CHECK_ORPHANS) process.exit(0);
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log(SHOW_ALL ? 'ALL UNTITLED DRILLS' : 'UNTITLED DRILLS — CREATED BY ADMIN');
    console.log(`${'─'.repeat(80)}\n`);

    toShow.forEach((drill, i) => {
      const assignedCount = Array.isArray(drill.assigned_to) ? drill.assigned_to.length : 0;
      const createdAt = drill.created_date
        ? new Date(drill.created_date as string).toISOString().split('T')[0]
        : 'unknown';

      console.log(`[${i + 1}] _id:           ${drill._id}`);
      console.log(`    title:         "${drill.title ?? '(missing)'}"`);
      console.log(`    type:          ${drill.type}`);
      console.log(`    difficulty:    ${drill.difficulty}`);
      console.log(`    created_by:    ${drill.created_by ?? '(none)'}`);
      console.log(`    createdById:   ${drill.createdById ?? '(none)'}`);
      console.log(`    created_date:  ${createdAt}`);
      console.log(`    is_active:     ${drill.is_active}`);
      console.log(`    assignments:   ${drill.totalAssignments ?? assignedCount}`);
      if (drill.context) {
        const preview = String(drill.context).slice(0, 80).replace(/\n/g, ' ');
        console.log(`    context:       ${preview}${String(drill.context).length > 80 ? '…' : ''}`);
      }
      console.log();
    });

    // Machine-readable summary for easy piping
    console.log('--- JSON summary ---');
    console.log(
      JSON.stringify(
        toShow.map((d) => ({
          _id: d._id.toString(),
          title: d.title ?? null,
          type: d.type,
          created_by: d.created_by,
          createdById: d.createdById?.toString(),
          created_date: d.created_date,
          is_active: d.is_active,
          totalAssignments: d.totalAssignments ?? 0,
        })),
        null,
        2
      )
    );

    // -----------------------------------------------------------------------
    // Orphan check: find attempts / assignments pointing to non-existent drills
    // -----------------------------------------------------------------------
    if (CHECK_ORPHANS) {
      console.log('\n' + '─'.repeat(80));
      console.log('ORPHAN CHECK — attempts & assignments referencing deleted drills');
      console.log('─'.repeat(80));

      // Collect all drill IDs that exist
      const existingDrillIds = new Set(
        (await Drill.find({}).select('_id').lean().exec()).map((d) => d._id.toString())
      );
      console.log(`\nTotal drills in DB: ${existingDrillIds.size}`);

      // Check attempts
      const allAttempts = await DrillAttempt.find({})
        .select('_id drillId learnerId completedAt')
        .lean()
        .exec();

      const orphanedAttempts = allAttempts.filter(
        (a) => !existingDrillIds.has(a.drillId?.toString())
      );

      console.log(`\nDrill attempts total:    ${allAttempts.length}`);
      console.log(`Orphaned attempts (drillId not in drills): ${orphanedAttempts.length}`);

      if (orphanedAttempts.length > 0) {
        // Group by missing drillId
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
            console.log(`  drillId ${drillId}  →  ${attempts.length} orphaned attempt(s)`);
            attempts.slice(0, 3).forEach((a) => {
              console.log(`    attempt _id: ${a._id}  learnerId: ${a.learnerId}  completedAt: ${a.completedAt ?? 'n/a'}`);
            });
            if (attempts.length > 3) console.log(`    ... and ${attempts.length - 3} more`);
          });
      }

      // Check assignments
      const allAssignments = await DrillAssignment.find({})
        .select('_id drillId learnerId status')
        .lean()
        .exec();

      const orphanedAssignments = allAssignments.filter(
        (a) => !existingDrillIds.has((a as any).drillId?.toString())
      );

      console.log(`\nDrill assignments total: ${allAssignments.length}`);
      console.log(`Orphaned assignments (drillId not in drills): ${orphanedAssignments.length}`);

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
            console.log(`  drillId ${drillId}  →  ${assignments.length} orphaned assignment(s)`);
          });
      }

      console.log('\n--- Orphan JSON summary ---');
      console.log(
        JSON.stringify({
          orphanedAttempts: orphanedAttempts.map((a) => ({
            _id: a._id.toString(),
            drillId: a.drillId?.toString(),
            learnerId: a.learnerId?.toString(),
          })),
          orphanedAssignments: orphanedAssignments.map((a: any) => ({
            _id: a._id.toString(),
            drillId: a.drillId?.toString(),
            learnerId: a.learnerId?.toString(),
            status: a.status,
          })),
        }, null, 2)
      );
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

findUntitledDrills();
