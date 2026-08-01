// Read-only diagnostic — computes weakness profiles live via aggregateWeaknesses
// for learners with a weekly_challenge this week. Does NOT save or modify anything.
// npx tsx --env-file=.env.local src/scripts/inspect-weakness-profiles.ts

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
import WeeklyChallengeModel from '@/models/weekly-challenge';
import UserModel from '@/models/user';
import { currentWeekStartUtc } from '@/lib/challenges/utc-week-challenge';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';
import type { WeaknessProfile, WeaknessSignal } from '@/domain/challenges/types';

const SIGNAL_DRILL_TYPES = ['pronunciation', 'vocabulary', 'key_phrases', 'roleplay'];

function formatSignalBreakdown(weaknesses: WeaknessSignal[]): string {
	const counts = new Map<string, number>();
	for (const w of weaknesses) {
		counts.set(w.drillType, (counts.get(w.drillType) ?? 0) + 1);
	}
	return SIGNAL_DRILL_TYPES.map((dt) => `${dt}=${counts.get(dt) ?? 0}`).join(' ');
}

function isGenericEvidence(evidence: string[]): boolean {
	return (
		evidence.length === 0 ||
		evidence.every((e) => !e || e.trim().length === 0)
	);
}

function isThin(profile: WeaknessProfile | undefined): boolean {
	if (!profile || !profile.topWeaknesses || profile.topWeaknesses.length === 0) return true;
	return profile.topWeaknesses.every((w) => isGenericEvidence(w.evidence ?? []));
}

function printWeakness(w: WeaknessSignal, index: number) {
	console.log(`    ${index + 1}. category=${w.category}  severity=${w.severity.toFixed(2)}  label="${w.label}"`);
	if (!w.evidence || w.evidence.length === 0) {
		console.log('       evidence: (none)');
	} else {
		console.log('       evidence:');
		for (const e of w.evidence) {
			console.log(`         - ${e}`);
		}
	}
}

async function main() {
	await connectToDatabase();

	const weekStartDate = currentWeekStartUtc();

	const challenges = await WeeklyChallengeModel.find({ weekStartDate }).lean();

	if (challenges.length === 0) {
		console.log(`No weekly challenges found for week starting ${weekStartDate.toISOString()}.`);
		await disconnectFromDatabase();
		return;
	}

	const learnerIds = [...new Set(challenges.map((c) => String(c.learnerId)))];
	const users = await UserModel.find({ _id: { $in: learnerIds } })
		.select('_id firstName lastName email')
		.lean();

	const userMap = new Map(
		users.map((u) => [
			String(u._id),
			{ name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(), email: u.email },
		])
	);

	const HR = '═'.repeat(70);

	console.log(
		`\nWeakness Profile Inspection — week starting ${weekStartDate.toISOString()} — ${challenges.length} learner${challenges.length !== 1 ? 's' : ''}\n`
	);

	let thinCount = 0;
	let richCount = 0;

	for (const challenge of challenges) {
		const user = userMap.get(String(challenge.learnerId));
		const name = user?.name ?? '(unknown)';
		const email = user?.email ?? '(unknown)';
		const learnerObjectId = new Types.ObjectId(String(challenge.learnerId));
		const profile = await aggregateWeaknesses(learnerObjectId, weekStartDate);
		const thin = isThin(profile);

		if (thin) thinCount++;
		else richCount++;

		console.log(HR);
		console.log(`  signals: ${formatSignalBreakdown(profile.weaknesses)}`);
		console.log(`  ${name}  <${email}>`);
		console.log(`  learnerId: ${challenge.learnerId}`);
		console.log(`  primaryMission: ${profile?.primaryMission ?? '(none)'}`);
		console.log(`  primaryTopic:   ${profile?.primaryTopic ?? '(none)'}`);
		console.log(`  country:        ${profile?.country ?? '(none)'}`);
		console.log(`  studentName:    ${profile?.studentName ?? '(none)'}`);
		console.log(`  studentRole:    ${profile?.studentRole ?? '(none)'}`);
		console.log(`  topWeaknesses:  ${profile?.topWeaknesses?.length ?? 0}`);

		if (profile?.topWeaknesses && profile.topWeaknesses.length > 0) {
			for (let i = 0; i < profile.topWeaknesses.length; i++) {
				printWeakness(profile.topWeaknesses[i], i);
			}
		}

		console.log(`  FLAG: ${thin ? 'THIN' : 'RICH'}`);
		console.log('');
	}

	console.log(HR);
	console.log(`\nSummary — RICH: ${richCount}   THIN: ${thinCount}   Total: ${challenges.length}\n`);

	await disconnectFromDatabase();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
