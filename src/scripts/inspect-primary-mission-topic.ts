// Read-only diagnostic — reports what computePrimaryMissionAndTopic() (used inside
// aggregateWeaknesses) returns for one learner, plus which drill attempts contributed
// to the mission/topic frequency counts. Does NOT save or modify anything.
// npx tsx --env-file=.env.local src/scripts/inspect-primary-mission-topic.ts <learnerId>

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
import DrillAttempt from '@/models/drill-attempt';

async function main() {
	const learnerIdArg = process.argv[2] ?? '6995750e9882aa80e597d516';
	const learnerId = new Types.ObjectId(learnerIdArg);

	await connectToDatabase();

	// Mirrors aggregateWeaknesses()'s lookback window: now - 14400 min (10 days), default lookbackMinutes.
	const now = new Date();
	const lookbackMinutes = 14400;
	const lookbackStart = new Date(now.getTime() - lookbackMinutes * 60_000);

	// Mirrors computePrimaryMissionAndTopic() exactly.
	const attempts = await DrillAttempt.find({
		learnerId,
		createdAt: { $gte: lookbackStart },
	})
		.populate('drillId', 'title type learning_journey_part learning_journey_topic')
		.lean();

	const partFreq = new Map<number, number>();
	const topicFreq = new Map<string, number>();

	type PopulatedAttempt = {
		_id: Types.ObjectId;
		drillType?: string;
		createdAt?: Date;
		completedAt?: Date;
		drillId?: {
			_id: Types.ObjectId;
			title?: string;
			type?: string;
			learning_journey_part?: number;
			learning_journey_topic?: string;
		};
	};

	for (const attempt of attempts as unknown as PopulatedAttempt[]) {
		const part = attempt.drillId?.learning_journey_part;
		const topic = attempt.drillId?.learning_journey_topic;
		if (part != null) partFreq.set(part, (partFreq.get(part) ?? 0) + 1);
		if (topic) topicFreq.set(topic, (topicFreq.get(topic) ?? 0) + 1);
	}

	const sortedParts = [...partFreq.entries()].sort((a, b) => b[1] - a[1]);
	const sortedTopics = [...topicFreq.entries()].sort((a, b) => b[1] - a[1]);

	const primaryMission = sortedParts[0]?.[0] ?? null;
	const primaryTopic = sortedTopics[0]?.[0] ?? null;

	console.log(`learnerId: ${learnerIdArg}`);
	console.log(`lookbackStart: ${lookbackStart.toISOString()}  (now: ${now.toISOString()})`);
	console.log(`total attempts in window: ${attempts.length}`);
	console.log('');
	console.log('=== computePrimaryMissionAndTopic() result ===');
	console.log(`primaryMission: ${primaryMission}`);
	console.log(`primaryTopic:   ${primaryTopic}`);
	console.log('');
	console.log('=== mission (learning_journey_part) frequency ===');
	for (const [part, freq] of sortedParts) console.log(`  Mission ${part}: ${freq} attempt(s)`);
	console.log('');
	console.log('=== topic (learning_journey_topic) frequency ===');
	for (const [topic, freq] of sortedTopics) console.log(`  ${topic}: ${freq} attempt(s)`);
	console.log('');
	console.log('=== contributing attempts (all, in window) ===');
	for (const attempt of attempts as unknown as PopulatedAttempt[]) {
		const d = attempt.drillId;
		console.log(
			`  attemptId=${attempt._id}  drillType=${attempt.drillType ?? '(none)'}  createdAt=${attempt.createdAt?.toISOString() ?? '(none)'}  completedAt=${attempt.completedAt?.toISOString() ?? '(none)'}`
		);
		if (d) {
			console.log(
				`    drill="${d.title ?? '(untitled)'}" (${d.type ?? '(no type)'})  learning_journey_part=${d.learning_journey_part ?? '(none)'}  learning_journey_topic=${d.learning_journey_topic ?? '(none)'}`
			);
		} else {
			console.log('    drill: (not found / not populated)');
		}
	}

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
