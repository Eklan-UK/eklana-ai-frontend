/**
 * Migration script to add hasProfile field to existing users
 * 
 * This script:
 * 1. Adds hasProfile field to User model (default: false)
 * 2. Sets hasProfile = true for users who have completed onboarding
 *    (users with learner/tutor profiles)
 * 3. Handles edge cases safely
 * 
 * Run with: npx ts-node scripts/migrate-user-hasProfile.ts
 */

import mongoose from 'mongoose';
import User from '../src/models/user';
import Learner from '../src/models/leaner';
import Tutor from '../src/models/tutor';
import config from '../src/lib/api/config';

async function migrate() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI || '');
    console.log('Connected to database');

    // Get all users
    const users = await User.find({}).exec();
    console.log(`Found ${users.length} users to migrate`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Check if user already has hasProfile set
        if (user.hasProfile !== undefined) {
          console.log(`User ${user._id} already has hasProfile set to ${user.hasProfile}, skipping`);
          skipped++;
          continue;
        }

        // Check if user has completed onboarding by checking for profile
        let hasProfile = false;

        if (user.role === 'learner') {
          const learnerProfile = await Learner.findOne({ userId: user._id }).exec();
          hasProfile = !!learnerProfile;
        } else if (user.role === 'tutor') {
          const tutorProfile = await Tutor.findOne({ userId: user._id }).exec();
          hasProfile = !!tutorProfile;
        } else {
          // For admin or users without role, set hasProfile to true
          // (they don't need onboarding)
          hasProfile = true;
        }

        // Update user
        user.hasProfile = hasProfile;
        await user.save();

        console.log(`Updated user ${user._id} (${user.email}): hasProfile = ${hasProfile}`);
        updated++;
      } catch (error: any) {
        console.error(`Error migrating user ${user._id}:`, error.message);
        errors++;
      }
    }

    console.log('\nMigration completed!');
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error: any) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();

