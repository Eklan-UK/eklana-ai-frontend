/**
 * Promotes a user to tutor (same logic as POST /api/v1/admin/assign-role).
 *
 * WARNING: User has a single `role`. Promoting an admin to tutor REMOVES admin access.
 *
 * Usage (from repo root, MONGO_URI set e.g. via .env.local):
 *   npx tsx scripts/promote-user-to-tutor.ts <userId>
 *
 * Optional second arg: approver admin ObjectId (defaults to same user for active tutor status).
 */
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import config from '../src/lib/api/config';
import { updateUserRole } from '../src/utils/onboarding';

async function main() {
  const userIdStr = process.argv[2];
  if (!userIdStr || !Types.ObjectId.isValid(userIdStr)) {
    console.error('Usage: npx tsx scripts/promote-user-to-tutor.ts <userId>');
    process.exit(1);
  }

  const uri = config.MONGO_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set. Add it to .env.local or export it.');
    process.exit(1);
  }

  const userId = new Types.ObjectId(userIdStr);
  const approverStr = process.argv[3];
  const approvedBy =
    approverStr && Types.ObjectId.isValid(approverStr)
      ? new Types.ObjectId(approverStr)
      : userId;

  console.log('Connecting…');
  await mongoose.connect(uri);

  const before = await mongoose.connection.db
    ?.collection('users')
    .findOne({ _id: userId }, { projection: { email: 1, role: 1, firstName: 1, lastName: 1 } });
  console.log('Before:', before);

  await updateUserRole(userId, 'tutor', {}, approvedBy);

  const after = await mongoose.connection.db
    ?.collection('users')
    .findOne({ _id: userId }, { projection: { email: 1, role: 1 } });
  const tutorDoc = await mongoose.connection.db
    ?.collection('tutors')
    .findOne({ userId });

  console.log('After user:', after);
  console.log('Tutor profile:', tutorDoc ? { _id: tutorDoc._id, status: tutorDoc.status } : null);
  console.log('Done.');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
