// Migration script to set hasProfile for existing users
// Run with: npx tsx scripts/migrate-has-profile.ts
// Dry run: npx tsx scripts/migrate-has-profile.ts --dry-run

import { connectToDatabase } from '../src/lib/api/db';
import User from '../src/models/user';
import Profile from '../src/models/profile';
import Tutor from '../src/models/tutor';

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateHasProfile() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    console.log('Connected to database');
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN MODE - No changes will be saved\n');
    }

    // Update users with role 'user' - check if they have a Profile
    console.log('Checking users with role "user"...');
    const users = await User.find({ role: 'user' }).exec();
    console.log(`Found ${users.length} users with role "user"`);

    let updatedCount = 0;
    for (const user of users) {
      const profile = await Profile.findOne({ userId: user._id }).exec();
      const hasProfile = !!profile;
      
      if (user.hasProfile !== hasProfile) {
        if (DRY_RUN) {
          console.log(`  Would update user ${user._id} (${user.email}): hasProfile ${user.hasProfile} → ${hasProfile}`);
        } else {
          user.hasProfile = hasProfile;
          await user.save();
        }
        updatedCount++;
      }
    }
    console.log(`${DRY_RUN ? 'Would update' : 'Updated'} ${updatedCount} users with role "user"`);

    // Admins and tutors always have profile (they don't need Profile document)
    console.log('Updating admins and tutors...');
    if (DRY_RUN) {
      const adminTutors = await User.find({ role: { $in: ['admin', 'tutor'] } }).exec();
      const wouldUpdate = adminTutors.filter(u => u.hasProfile !== true).length;
      console.log(`  Would update ${wouldUpdate} admins/tutors to hasProfile: true`);
    } else {
      const adminTutorResult = await User.updateMany(
        { role: { $in: ['admin', 'tutor'] } },
        { hasProfile: true }
      );
      console.log(`Updated ${adminTutorResult.modifiedCount} admins/tutors`);
    }

    // Also check tutors have Tutor profile (optional check)
    const tutors = await User.find({ role: 'tutor' }).exec();
    let tutorsWithProfile = 0;
    for (const tutor of tutors) {
      const tutorProfile = await Tutor.findOne({ userId: tutor._id }).exec();
      if (tutorProfile) {
        tutorsWithProfile++;
      }
    }
    console.log(`${tutorsWithProfile} tutors have Tutor profiles`);

    console.log(`\n${DRY_RUN ? '✅ Dry run complete!' : '✅ Migration complete!'}`);
    if (!DRY_RUN) {
      console.log(`- Updated ${updatedCount} users based on Profile existence`);
    }
    
    // Summary
    const totalUsers = await User.countDocuments({});
    const usersWithProfile = await User.countDocuments({ hasProfile: true });
    console.log(`\nSummary:`);
    console.log(`- Total users: ${totalUsers}`);
    console.log(`- Users with hasProfile: true: ${usersWithProfile}`);
    console.log(`- Users with hasProfile: false: ${totalUsers - usersWithProfile}`);
    
  } catch (error: any) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrateHasProfile();

