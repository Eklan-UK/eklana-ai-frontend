// Read-only diagnostic — computes the practiced_scenarios placeholder value
// exactly as substitutePlaceholders() does in challenge-generator.ts, for one
// learner. Does NOT save or modify anything.
// npx tsx --env-file=.env.local src/scripts/inspect-practiced-scenarios.ts <learnerId>

import 'dotenv/config';
import { Types } from 'mongoose';
import '@/models/drill';
import '@/models/drill-attempt';
import '@/models/pronunciation-attempt';
import '@/models/free-talk-attempt';
import '@/models/bookmark';
import '@/models/studentContext';
import '@/models/user';

import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';

async function main() {
	const learnerIdArg = process.argv[2] ?? '6995750e9882aa80e597d516';

	await connectToDatabase();

	const weekStartDate = currentWeekStartUtc();
	const learnerObjectId = new Types.ObjectId(learnerIdArg);

	const profile = await aggregateWeaknesses(learnerObjectId, weekStartDate);

	// Mirrors extractEvidence() in challenge-generator.ts exactly:
	const evidence = profile.weaknesses
		.filter((w) => w.drillType === 'roleplay' || w.drillType === 'free_talk')
		.flatMap((w) => w.evidence);
	const unique = [...new Set(evidence)];
	const practicedScenarios = unique.length > 0 ? unique.join('; ') : 'None recorded this week';

	console.log(`learnerId: ${learnerIdArg}`);
	console.log(`weekStartDate: ${weekStartDate.toISOString()}`);
	console.log('');
	console.log('=== practiced_scenarios (exact substituted value) ===');
	console.log(practicedScenarios);
	console.log('');
	console.log('=== raw roleplay/free_talk weakness signals (pre-join) ===');
	const relevant = profile.weaknesses.filter((w) => w.drillType === 'roleplay' || w.drillType === 'free_talk');
	if (relevant.length === 0) {
		console.log('(none)');
	} else {
		for (const w of relevant) {
			console.log(`- drillType=${w.drillType} category=${w.category} severity=${w.severity.toFixed(3)} label="${w.label}"`);
			for (const e of w.evidence) {
				console.log(`    - ${e}`);
			}
		}
	}
	console.log('');

	const scenarioLines = unique.filter((e) => e.startsWith('Practised scenario:'));
	console.log(`=== "Practised scenario:" entries: ${scenarioLines.length} ===`);
	scenarioLines.forEach((line, i) => console.log(`${i + 1}. ${line}`));

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
