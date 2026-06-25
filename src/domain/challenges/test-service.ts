// run with:
// npx tsx src/domain/challenges/test-service.ts

import '@/scripts/load-env';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import { ChallengeRepository } from './challenge.repository';
import { ChallengeService } from './challenge.service';

async function main() {
	await connectToDatabase();
	const service = new ChallengeService(new ChallengeRepository());
	const learnerId = new Types.ObjectId('6a145e8ea1983cbd047bfd49');
	const weekStartDate = new Date('2026-06-08T00:00:00.000Z');
	const result = await service.getOrGenerateChallenge(learnerId, weekStartDate);
	console.log(JSON.stringify(result, null, 2));
	await disconnectFromDatabase();
}

main().catch(err => { console.error(err); process.exit(1); });
