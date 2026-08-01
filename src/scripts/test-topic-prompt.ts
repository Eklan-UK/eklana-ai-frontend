// npx tsx --env-file=.env.local src/scripts/test-topic-prompt.ts
//
// Dev script for testing topic-specific prompts without waiting for real drill
// data. Edit the config constants below between runs to point at any learner,
// lookback window, mission, and topic you want to exercise.

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import {
	aggregateWeaknesses,
} from '@/domain/challenges/weakness-aggregator';
import {
	generateWeeklyChallenge,
	getTopicPrompt,
} from '@/domain/challenges/challenge-generator';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import UserModel from '@/models/user';
import { formatDrillBlock } from './lib/weekly-challenge-format';

// Side-effect imports: register every model the aggregator touches so populate()
// and ref lookups resolve when this script runs standalone.
import '@/models/drill';
import '@/models/drill-attempt';
import '@/models/pronunciation-attempt';
import '@/models/free-talk-attempt';
import '@/models/bookmark';
import '@/models/studentContext';

// ── Config (edit between runs) ──────────────────────────────────────────────
const LEARNER_ID = '6a145e8ea1983cbd047bfd49'; // Litima
const LOOKBACK_MINUTES = 1440; // 30 for last half hour, 1440 for 24 hrs
const OVERRIDE_MISSION: number | null = 4;
const OVERRIDE_TOPIC: string | null = 'motivation_prep';
// ────────────────────────────────────────────────────────────────────────────

async function main() {
	await connectToDatabase();

	const learnerId = new Types.ObjectId(LEARNER_ID);
	const weekStartDate = currentWeekStartUtc();
	console.log(`weekStartDate: ${weekStartDate.toISOString()}`);
	console.log(`lookbackMinutes: ${LOOKBACK_MINUTES}`);

	await WeeklyChallengeModel.deleteMany({ learnerId, weekStartDate });
	console.log('Deleted existing weekly_challenge for this learner/week.');

	const profile = await aggregateWeaknesses(learnerId, weekStartDate, LOOKBACK_MINUTES);

	// Override mission/topic so any topic prompt can be tested on demand, even
	// when the learner's recent drill history doesn't point at it.
	if (OVERRIDE_MISSION !== null) profile.primaryMission = OVERRIDE_MISSION;
	if (OVERRIDE_TOPIC !== null) profile.primaryTopic = OVERRIDE_TOPIC;

	console.log('\n─── Weakness profile ───');
	console.log('topWeaknesses:', JSON.stringify(profile.topWeaknesses, null, 2));
	console.log('primaryMission:', profile.primaryMission);
	console.log('primaryTopic:', profile.primaryTopic);
	console.log('studentName:', profile.studentName);
	console.log('studentRole:', profile.studentRole);
	console.log('country:', profile.country);

	const content = await generateWeeklyChallenge(profile);

	const saved = await WeeklyChallengeModel.findOneAndUpdate(
		{ learnerId, weekStartDate },
		{
			$set: {
				learnerId,
				weekStartDate,
				weaknessProfile: profile,
				challengeType: 'structured_drill_sequence',
				content,
				status: 'ready',
				generatedAt: new Date(),
			},
		},
		{ upsert: true, new: true }
	);

	// ── Full report printout ──────────────────────────────────────────────
	const user = await UserModel.findById(learnerId)
		.select('firstName lastName email')
		.lean<{ firstName?: string; lastName?: string; email?: string } | null>();
	const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '(unknown)';
	const email = user?.email ?? '(unknown)';

	const generatedAt = saved?.generatedAt
		? saved.generatedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
		: '—';
	const totalMin = saved?.content?.totalEstimatedMinutes;
	const summary = saved?.content?.summaryMessage;
	const sequence: Array<{ drillType: string; instructions?: string; generatedContent: any }> =
		saved?.content?.drillSequence ?? [];

	const HR = '═'.repeat(70);

	console.log(`\n${HR}`);
	console.log(`  ${name}  <${email}>`);
	console.log(`  Generated: ${generatedAt}${totalMin != null ? `   Est. ${totalMin} min` : ''}`);
	if (summary) console.log(`  Summary:   ${summary}`);
	console.log(`  Mission:   ${profile.primaryMission ?? '(none)'}`);
	console.log(`  Topic:     ${profile.primaryTopic ?? '(none)'}`);
	console.log('');
	console.log('  Prompt source per drill:');
	for (const drill of sequence) {
		const usedTopicPrompt =
			getTopicPrompt(profile.primaryMission ?? null, profile.primaryTopic ?? null, drill.drillType) !== null;
		console.log(
			`    ${drill.drillType.padEnd(14)} → ${usedTopicPrompt ? 'topic prompt' : 'generic fallback'}`
		);
	}
	console.log('');

	for (const drill of sequence) {
		for (const line of formatDrillBlock(drill)) console.log(line);
		console.log('');
	}

	console.log(HR);

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
