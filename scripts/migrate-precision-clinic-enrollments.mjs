/**
 * One-time migration: auto-enroll learners who already have Precision Clinic
 * assignments so they are not locked out after the enrollment gate ships.
 *
 * Usage:
 *   node scripts/migrate-precision-clinic-enrollments.mjs
 *
 * Idempotent via unique index on learnerId. Existing withdrawn records are
 * left unchanged so a later re-run does not undo an admin withdraw.
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

const learnerPrecisionClinicEnrollmentSchema = new mongoose.Schema(
  {
    learnerId: { type: mongoose.Schema.Types.Mixed, required: true },
    enrolledBy: { type: mongoose.Schema.Types.Mixed, required: true },
    enrolledAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'withdrawn'], default: 'active' },
  },
  { timestamps: true, collection: 'learner_precision_clinic_enrollments' },
);

learnerPrecisionClinicEnrollmentSchema.index({ learnerId: 1 }, { unique: true });

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

  const DrillAssignment =
    mongoose.models.DrillAssignmentMigrate ||
    mongoose.model('DrillAssignmentMigrate', drillAssignmentSchema);
  const Drill =
    mongoose.models.DrillMigrate ||
    mongoose.model('DrillMigrate', drillSchema);
  const LearnerPrecisionClinicEnrollment =
    mongoose.models.LearnerPrecisionClinicEnrollmentMigrate ||
    mongoose.model(
      'LearnerPrecisionClinicEnrollmentMigrate',
      learnerPrecisionClinicEnrollmentSchema,
    );

  const assignmentLearnerIds = await DrillAssignment.distinct('learnerId', {
    source: 'precision_clinic',
  });

  const clinicDrills = await Drill.find({ source: 'precision_clinic' })
    .select('assigned_to')
    .lean()
    .exec();

  const learners = new Map();
  for (const learnerId of assignmentLearnerIds) {
    if (learnerId == null) continue;
    learners.set(String(learnerId), learnerId);
  }
  for (const drill of clinicDrills) {
    const assigned = Array.isArray(drill.assigned_to) ? drill.assigned_to : [];
    for (const learnerId of assigned) {
      if (learnerId == null) continue;
      const key = String(learnerId);
      if (!learners.has(key)) learners.set(key, learnerId);
    }
  }

  console.log(
    `Found ${learners.size} learners with existing Precision Clinic assignments`,
  );

  let upserted = 0;
  let skipped = 0;

  for (const learnerId of learners.values()) {
    const result = await LearnerPrecisionClinicEnrollment.findOneAndUpdate(
      { learnerId },
      {
        $setOnInsert: {
          learnerId,
          status: 'active',
          enrolledBy: SYSTEM_ENROLLED_BY,
          enrolledAt: new Date(),
        },
      },
      { upsert: true, new: true, rawResult: true },
    ).exec();

    if (result?.lastErrorObject?.updatedExisting === false) {
      upserted += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    `Migration complete: ${upserted} created, ${skipped} already existed`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
