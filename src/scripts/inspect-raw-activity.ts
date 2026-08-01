// Read-only diagnostic — inspects raw drill/pronunciation/free-talk activity
// for a single learner over the past 10 days. Does NOT write anything.
// npx tsx --env-file=.env.local src/scripts/inspect-raw-activity.ts

import 'dotenv/config';
import '@/models/drill';
import '@/models/user';

import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import DrillAttemptModel from '@/models/drill-attempt';
import PronunciationAttemptModel from '@/models/pronunciation-attempt';
import FreeTalkAttemptModel from '@/models/free-talk-attempt';
import type { IDrillAttempt } from '@/models/drill-attempt';

const LEARNER_ID = '6998629dd7e5e5284b7fc9b6';

interface PopulatedDrill {
	_id: mongoose.Types.ObjectId;
	learning_journey_part?: number;
	learning_journey_topic?: string;
}

async function main() {
	await connectToDatabase();

	const learnerId = new mongoose.Types.ObjectId(LEARNER_ID);
	const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

	const HR = '═'.repeat(70);

	console.log(`\nRaw Activity Inspection — learnerId=${LEARNER_ID} — since ${tenDaysAgo.toISOString()}\n`);

	// 1. DrillAttempt
	const drillAttempts = (await DrillAttemptModel.find({
		learnerId,
		createdAt: { $gte: tenDaysAgo },
	})
		.populate('drillId', 'learning_journey_part learning_journey_topic')
		.sort({ createdAt: -1 })
		.lean()) as unknown as Array<IDrillAttempt & { drillId: PopulatedDrill | null }>;

	console.log(HR);
	console.log(`DRILL ATTEMPTS (${drillAttempts.length})`);
	console.log(HR);

	const byDrillType = new Map<string, number>();
	let withPartOrTopic = 0;

	for (const attempt of drillAttempts) {
		const drillType = attempt.drillType ?? '(none)';
		byDrillType.set(drillType, (byDrillType.get(drillType) ?? 0) + 1);

		const drill = attempt.drillId;
		const part = drill?.learning_journey_part ?? 'MISSING';
		const topic = drill?.learning_journey_topic ?? 'MISSING';
		if (drill?.learning_journey_part != null || drill?.learning_journey_topic != null) {
			withPartOrTopic++;
		}

		const fillBlank = attempt.fillBlankResults;
		const fillBlankItemCount = fillBlank?.items?.length ?? 0;
		const fillBlankIncorrect = (fillBlank?.items ?? []).reduce(
			(sum, item) => sum + (item.blanks ?? []).filter((b) => b.isCorrect === false).length,
			0
		);

		const keyPhrases = attempt.keyPhrasesResults;
		const keyPhrasesItemCount = keyPhrases?.items?.length ?? 0;
		const keyPhrasesIncorrect = (keyPhrases?.items ?? []).filter((i) => i.isCorrect === false).length;

		console.log(`\n  drillType: ${drillType}`);
		console.log(`  createdAt: ${attempt.createdAt?.toISOString() ?? '(none)'}`);
		console.log(`  drillId:   ${drill?._id ?? attempt.drillId}`);
		console.log(`  learning_journey_part:  ${part}`);
		console.log(`  learning_journey_topic: ${topic}`);
		console.log(
			`  fillBlankResults:  ${fillBlank ? `present — ${fillBlankItemCount} item(s), ${fillBlankIncorrect} incorrect` : 'absent'}`
		);
		console.log(
			`  keyPhrasesResults: ${keyPhrases ? `present — ${keyPhrasesItemCount} item(s), ${keyPhrasesIncorrect} incorrect` : 'absent'}`
		);
	}

	// 2. PronunciationAttempt
	const pronAttempts = await PronunciationAttemptModel.find({
		learnerId,
		createdAt: { $gte: tenDaysAgo },
	})
		.select('createdAt')
		.sort({ createdAt: 1 })
		.lean();

	console.log(`\n${HR}`);
	console.log(`PRONUNCIATION ATTEMPTS (${pronAttempts.length})`);
	console.log(HR);
	if (pronAttempts.length > 0) {
		console.log(
			`  Date range: ${pronAttempts[0].createdAt?.toISOString()} → ${pronAttempts[pronAttempts.length - 1].createdAt?.toISOString()}`
		);
	} else {
		console.log('  (none)');
	}

	// 3. FreeTalkAttempt
	const freeTalkAttempts = await FreeTalkAttemptModel.find({
		learnerId,
		createdAt: { $gte: tenDaysAgo },
	})
		.select('createdAt')
		.sort({ createdAt: 1 })
		.lean();

	console.log(`\n${HR}`);
	console.log(`FREE TALK ATTEMPTS (${freeTalkAttempts.length})`);
	console.log(HR);
	if (freeTalkAttempts.length > 0) {
		console.log(
			`  Date range: ${freeTalkAttempts[0].createdAt?.toISOString()} → ${freeTalkAttempts[freeTalkAttempts.length - 1].createdAt?.toISOString()}`
		);
	} else {
		console.log('  (none)');
	}

	// 4. Summary
	console.log(`\n${HR}`);
	console.log('SUMMARY');
	console.log(HR);
	console.log(`  Total drill attempts: ${drillAttempts.length}`);
	for (const [type, count] of [...byDrillType.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`    ${type}: ${count}`);
	}
	console.log(
		`  Drill attempts with learning_journey_part/topic populated: ${withPartOrTopic} / ${drillAttempts.length}`
	);
	console.log(`  Pronunciation attempts: ${pronAttempts.length}`);
	console.log(`  Free talk attempts: ${freeTalkAttempts.length}\n`);

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
