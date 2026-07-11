/**
 * One-time migration: auto-enroll learners in missions where they already have
 * assigned drills with learning_journey_part set.
 *
 * Usage:
 *   node scripts/migrate-mission-enrollments.mjs
 *
 * Idempotent via unique index on { learnerId, learningJourneyPart }.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const uri = (process.env.MONGO_URI || '').trim();
if (!uri) {
  console.error('MONGO_URI is not set (add it to .env or export it).');
  process.exit(1);
}

const SYSTEM_ENROLLED_BY = '000000000000000000000001';

const learnerMissionEnrollmentSchema = new mongoose.Schema(
  {
    learnerId: { type: mongoose.Schema.Types.Mixed, required: true },
    learningJourneyPart: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    enrolledBy: { type: mongoose.Schema.Types.Mixed, required: true },
    enrolledAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'withdrawn'], default: 'active' },
  },
  { timestamps: true, collection: 'learner_mission_enrollments' },
);

learnerMissionEnrollmentSchema.index(
  { learnerId: 1, learningJourneyPart: 1 },
  { unique: true },
);

const drillAssignmentSchema = new mongoose.Schema(
  {},
  { strict: false, collection: 'drill_assignments' },
);

const drillSchema = new mongoose.Schema(
  {},
  { strict: false, collection: 'drills' },
);

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const DrillAssignment = mongoose.models.DrillAssignmentMigrate ||
    mongoose.model('DrillAssignmentMigrate', drillAssignmentSchema);
  const Drill = mongoose.models.DrillMigrate ||
    mongoose.model('DrillMigrate', drillSchema);
  const LearnerMissionEnrollment = mongoose.models.LearnerMissionEnrollmentMigrate ||
    mongoose.model('LearnerMissionEnrollmentMigrate', learnerMissionEnrollmentSchema);

  const assignments = await DrillAssignment.find({})
    .select('learnerId drillId')
    .lean()
    .exec();

  console.log(`Found ${assignments.length} drill assignments`);

  const pairs = new Map<string, { learnerId: unknown; part: number }>();

  for (const assignment of assignments) {
    const drill = await Drill.findById(assignment.drillId)
      .select('learning_journey_part')
      .lean()
      .exec();
    const part = drill?.learning_journey_part;
    if (part == null || part < 1 || part > 5) continue;

    const learnerId = assignment.learnerId;
    const key = `${String(learnerId)}:${part}`;
    if (!pairs.has(key)) {
      pairs.set(key, { learnerId, part });
    }
  }

  console.log(`Found ${pairs.size} unique learner/mission pairs from existing drills`);

  let upserted = 0;
  let skipped = 0;

  for (const { learnerId, part } of pairs.values()) {
    const result = await LearnerMissionEnrollment.findOneAndUpdate(
      { learnerId, learningJourneyPart: part },
      {
        $set: {
          status: 'active',
          enrolledBy: SYSTEM_ENROLLED_BY,
          enrolledAt: new Date(),
        },
        $setOnInsert: { learnerId, learningJourneyPart: part },
      },
      { upsert: true, new: true, rawResult: true },
    ).exec();

    if (result?.lastErrorObject?.updatedExisting === false) {
      upserted += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`Migration complete: ${upserted} created, ${skipped} already existed`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
