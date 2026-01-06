/**
 * Migration script to refactor from Learner to Profile and Progress models
 * 
 * This script:
 * 1. Migrates Learner data to Profile
 * 2. Migrates LearnerPronunciationProgress to Progress (type: pronunciation)
 * 3. Updates User roles from "learner" to "user"
 * 4. Removes hasProfile field from User (no longer needed)
 * 
 * Run with: npx ts-node scripts/migrate-to-profile-progress.ts
 */

import mongoose from 'mongoose';
import User from '../src/models/user';
import Learner from '../src/models/leaner';
import Profile from '../src/models/profile';
import LearnerPronunciationProgress from '../src/models/learner-pronunciation-progress';
import Progress from '../src/models/progress';
import config from '../src/lib/api/config';

async function migrate() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI || '');
    console.log('Connected to database');

    // Step 1: Migrate Learner to Profile
    console.log('\n=== Step 1: Migrating Learner to Profile ===');
    const learners = await Learner.find({}).exec();
    console.log(`Found ${learners.length} learners to migrate`);

    let profilesCreated = 0;
    let profilesSkipped = 0;

    for (const learner of learners) {
      try {
        // Check if profile already exists
        const existingProfile = await Profile.findOne({ userId: learner.userId }).exec();
        if (existingProfile) {
          console.log(`Profile already exists for user ${learner.userId}, skipping`);
          profilesSkipped++;
          continue;
        }

        // Create profile from learner data
        await Profile.create({
          userId: learner.userId,
          tutorId: learner.tutorId,
          gradeLevel: learner.gradeLevel,
          subjects: learner.subjects || [],
          learningGoals: learner.learningGoals || [],
          learningStyle: learner.learningStyle,
          educationLevel: learner.educationLevel,
          parentContact: learner.parentContact,
          preferences: learner.preferences || {
            sessionDuration: 60,
            preferredTimeSlots: [],
            learningPace: 'moderate',
          },
          status: learner.status || 'active',
          notes: learner.notes,
          createdAt: learner.createdAt,
          updatedAt: learner.updatedAt,
        });

        console.log(`Created profile for user ${learner.userId}`);
        profilesCreated++;
      } catch (error: any) {
        console.error(`Error migrating learner ${learner._id}:`, error.message);
      }
    }

    console.log(`Profiles created: ${profilesCreated}, Skipped: ${profilesSkipped}`);

    // Step 2: Migrate LearnerPronunciationProgress to Progress
    console.log('\n=== Step 2: Migrating Pronunciation Progress ===');
    const pronunciationProgresses = await LearnerPronunciationProgress.find({}).exec();
    console.log(`Found ${pronunciationProgresses.length} pronunciation progress records to migrate`);

    let progressCreated = 0;
    let progressSkipped = 0;

    for (const prog of pronunciationProgresses) {
      try {
        // Get user ID from learner
        const learner = await Learner.findById(prog.learnerId).exec();
        if (!learner) {
          console.log(`Learner not found for progress ${prog._id}, skipping`);
          progressSkipped++;
          continue;
        }

        // Check if progress already exists
        const existingProgress = await Progress.findOne({
          userId: learner.userId,
          type: 'pronunciation',
          'pronunciationData.wordId': prog.wordId,
        }).exec();

        if (existingProgress) {
          console.log(`Progress already exists for user ${learner.userId} word ${prog.wordId}, skipping`);
          progressSkipped++;
          continue;
        }

        // Create progress from pronunciation progress
        await Progress.create({
          userId: learner.userId,
          type: 'pronunciation',
          pronunciationData: {
            problemId: prog.problemId,
            wordId: prog.wordId,
            attempts: prog.attempts || 0,
            accuracyScores: prog.accuracyScores || [],
            bestScore: prog.bestScore,
            averageScore: prog.averageScore,
            isChallenging: prog.isChallenging || false,
            challengeLevel: prog.challengeLevel,
            weakPhonemes: prog.weakPhonemes || [],
            incorrectLetters: prog.incorrectLetters || [],
            passed: prog.passed || false,
            passedAt: prog.passedAt,
          },
          lastAttemptAt: prog.lastAttemptAt,
          createdAt: prog.createdAt,
          updatedAt: prog.updatedAt,
        });

        console.log(`Created progress for user ${learner.userId} word ${prog.wordId}`);
        progressCreated++;
      } catch (error: any) {
        console.error(`Error migrating pronunciation progress ${prog._id}:`, error.message);
      }
    }

    console.log(`Progress records created: ${progressCreated}, Skipped: ${progressSkipped}`);

    // Step 3: Update User roles from "learner" to "user"
    console.log('\n=== Step 3: Updating User roles ===');
    const usersToUpdate = await User.updateMany(
      { role: 'learner' },
      { $set: { role: 'user' } }
    ).exec();
    console.log(`Updated ${usersToUpdate.modifiedCount} users from "learner" to "user" role`);

    // Step 4: Remove hasProfile field from User (no longer needed)
    console.log('\n=== Step 4: Removing hasProfile field ===');
    const usersWithHasProfile = await User.updateMany(
      { hasProfile: { $exists: true } },
      { $unset: { hasProfile: '' } }
    ).exec();
    console.log(`Removed hasProfile field from ${usersWithHasProfile.modifiedCount} users`);

    console.log('\n=== Migration completed successfully! ===');
    console.log(`Summary:`);
    console.log(`- Profiles created: ${profilesCreated}`);
    console.log(`- Progress records created: ${progressCreated}`);
    console.log(`- Users updated: ${usersToUpdate.modifiedCount}`);
    console.log(`- hasProfile fields removed: ${usersWithHasProfile.modifiedCount}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  } catch (error: any) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();

