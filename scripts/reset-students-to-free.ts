// Reset all student users to the free subscription tier.
// Run with:      npx tsx scripts/reset-students-to-free.ts
// Dry run:       npx tsx scripts/reset-students-to-free.ts --dry-run

import { connectToDatabase } from '../src/lib/api/db';
import User from '../src/models/user';

const DRY_RUN = process.argv.includes('--dry-run');

async function resetStudentsToFree() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    console.log('Connected.');

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN — no changes will be saved\n');
    }

    const alreadyFreeCount = await User.countDocuments({
      role: 'user',
      subscriptionPlan: 'free',
    });
    const toResetCount = await User.countDocuments({
      role: 'user',
      subscriptionPlan: { $ne: 'free' },
    });

    console.log(`Students already on free:    ${alreadyFreeCount}`);
    console.log(`Students that will be reset: ${toResetCount}`);

    if (toResetCount === 0) {
      console.log('\nNothing to do — all students are already on the free tier.');
      process.exit(0);
    }

    if (DRY_RUN) {
      const users = await User.find({ role: 'user', subscriptionPlan: { $ne: 'free' } })
        .select('email subscriptionPlan subscriptionExpiresAt')
        .lean()
        .exec();
      for (const u of users) {
        console.log(
          `  Would reset: ${u.email}  (was: ${u.subscriptionPlan}, expires: ${u.subscriptionExpiresAt ?? 'n/a'})`
        );
      }
      console.log('\n✅ Dry run complete. Re-run without --dry-run to apply.');
      process.exit(0);
    }

    const result = await User.updateMany(
      { role: 'user' },
      {
        $set: {
          subscriptionPlan: 'free',
          subscriptionExpiresAt: null,
          subscriptionActivatedAt: null,
          stripeSubscriptionStatus: null,
        },
        $unset: {
          stripeSubscriptionId: '',
        },
      }
    );

    console.log(`\n✅ Done. Modified ${result.modifiedCount} student user(s) → free tier.`);

    const summary = await User.countDocuments({ role: 'user', subscriptionPlan: 'free' });
    console.log(`Students on free tier now: ${summary}`);
  } catch (error: any) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

resetStudentsToFree();
