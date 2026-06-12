import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import WeeklyChallengeModel from '@/models/weekly-challenge';

const LEARNER_ID = new Types.ObjectId('6a145e8ea1983cbd047bfd49');

async function main() {
	await connectToDatabase();
	await WeeklyChallengeModel.deleteMany({ learnerId: LEARNER_ID });
	console.log('Deleted');
	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
