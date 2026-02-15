// Migration script to set type field on pronunciation words from their problem's type
// Run with: npx tsx scripts/migrate-pronunciation-word-types.ts
// Dry run: npx tsx scripts/migrate-pronunciation-word-types.ts --dry-run

import { connectToDatabase } from '../src/lib/api/db';
import PronunciationProblem from '../src/models/pronunciation-problem';
import PronunciationWord from '../src/models/pronunciation-word';

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateWordTypes() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    console.log('Connected to database');

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN MODE - No changes will be saved\n');
    }

    // Get all problems with their type
    const problems = await PronunciationProblem.find({}).lean().exec();
    console.log(`Found ${problems.length} pronunciation problems`);

    let totalWords = 0;
    let updatedWords = 0;
    let skippedWords = 0;

    for (const problem of problems) {
      if (!problem.type) {
        console.log(`⚠️  Problem "${problem.title}" (${problem._id}) has no type, skipping its words`);
        continue;
      }

      // Find all words for this problem that don't have a type
      const words = await PronunciationWord.find({
        problemId: problem._id,
        $or: [
          { type: { $exists: false } },
          { type: null },
          { type: undefined },
        ],
      }).exec();

      totalWords += words.length;

      if (words.length > 0) {
        console.log(`\nProblem: "${problem.title}" (type: ${problem.type})`);
        console.log(`  Found ${words.length} words without type`);

        for (const word of words) {
          if (DRY_RUN) {
            console.log(`    Would update word "${word.word}" (${word._id}): type undefined → ${problem.type}`);
          } else {
            word.type = problem.type as 'word' | 'sound' | 'sentence';
            await word.save();
            console.log(`    ✅ Updated word "${word.word}": type = ${problem.type}`);
          }
          updatedWords++;
        }
      } else {
        skippedWords += words.length;
      }
    }

    console.log(`\n${DRY_RUN ? '✅ Dry run complete!' : '✅ Migration complete!'}`);
    console.log(`\nSummary:`);
    console.log(`- Total words processed: ${totalWords}`);
    console.log(`- Words ${DRY_RUN ? 'would be' : ''} updated: ${updatedWords}`);
    console.log(`- Words skipped: ${skippedWords}`);

    // Verify: Check if there are any words still without type
    const wordsWithoutType = await PronunciationWord.countDocuments({
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: undefined },
      ],
    });
    console.log(`- Words still without type: ${wordsWithoutType}`);

  } catch (error: any) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrateWordTypes();





