// Run once for demo purposes. Safe to re-run — uses insertMany.
// npx ts-node -r tsconfig-paths/register src/scripts/seed-test-challenge.ts

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import DrillAttemptModel from '@/models/drill-attempt';
import PronunciationAttemptModel from '@/models/pronunciation-attempt';

const LEARNER_ID = new Types.ObjectId('6a145e8ea1983cbd047bfd49');

function getMostRecentMonday(): Date {
	const now = new Date();
	const dayOfWeek = now.getUTCDay();
	const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const monday = new Date(now);
	monday.setUTCDate(now.getUTCDate() + daysToMonday);
	monday.setUTCHours(0, 0, 0, 0);
	return monday;
}

function dayOffset(base: Date, days: number): Date {
	const d = new Date(base);
	d.setUTCDate(d.getUTCDate() + days);
	d.setUTCHours(10, 0, 0, 0);
	return d;
}

async function main() {
	await connectToDatabase();

	const weekStartDate = getMostRecentMonday();
	console.log(`weekStartDate: ${weekStartDate.toISOString()}`);

	// ── Drill attempts ────────────────────────────────────────────────────────

	const drillAttempts = [
		{
			learnerId: LEARNER_ID,
			drillId: new Types.ObjectId(),
			drillAssignmentId: new Types.ObjectId(),
			drillType: 'vocabulary',
			score: 65,
			maxScore: 100,
			startedAt: dayOffset(weekStartDate, 0),
			completedAt: dayOffset(weekStartDate, 0),
			timeSpent: 240,
			vocabularyResults: {
				wordScores: [
					{ word: 'negotiate', score: 60, attempts: 2, pronunciationScore: 58 },
					{ word: 'collaborate', score: 55, attempts: 3, pronunciationScore: 52 },
					{ word: 'implement', score: 70, attempts: 1, pronunciationScore: 65 },
				],
			},
		},
		{
			learnerId: LEARNER_ID,
			drillId: new Types.ObjectId(),
			drillAssignmentId: new Types.ObjectId(),
			drillType: 'roleplay',
			score: 72,
			maxScore: 100,
			startedAt: dayOffset(weekStartDate, 1),
			completedAt: dayOffset(weekStartDate, 1),
			timeSpent: 300,
			roleplayResults: {
				sceneScores: [
					{ sceneName: 'Job Interview', score: 72, fluencyScore: 68, pronunciationScore: 70 },
				],
			},
		},
		{
			learnerId: LEARNER_ID,
			drillId: new Types.ObjectId(),
			drillAssignmentId: new Types.ObjectId(),
			drillType: 'pronunciation',
			score: 58,
			maxScore: 100,
			startedAt: dayOffset(weekStartDate, 2),
			completedAt: dayOffset(weekStartDate, 2),
			timeSpent: 180,
			pronunciationResults: {
				wordScores: [
					{ word: 'through', score: 52, attempts: 3, pronunciationScore: 48 },
					{ word: 'vocabulary', score: 60, attempts: 2, pronunciationScore: 55 },
					{ word: 'river', score: 58, attempts: 2, pronunciationScore: 54 },
				],
			},
		},
		{
			learnerId: LEARNER_ID,
			drillId: new Types.ObjectId(),
			drillAssignmentId: new Types.ObjectId(),
			drillType: 'key_phrases',
			score: 70,
			maxScore: 100,
			startedAt: dayOffset(weekStartDate, 3),
			completedAt: dayOffset(weekStartDate, 3),
			timeSpent: 210,
			keyPhrasesResults: {
				items: [
					{
						prompt: 'How do you greet a colleague?',
						selectedAnswer: 'How are you doing?',
						correctAnswer: 'How are you doing?',
						isCorrect: true,
						pronunciationScore: 68,
						attempts: 1,
					},
					{
						prompt: 'How do you end a meeting?',
						selectedAnswer: 'Let us wrap up.',
						correctAnswer: "Let's wrap up.",
						isCorrect: false,
						pronunciationScore: 62,
						attempts: 2,
					},
				],
				totalItems: 2,
				correctItems: 1,
				score: 70,
			},
		},
		{
			learnerId: LEARNER_ID,
			drillId: new Types.ObjectId(),
			drillAssignmentId: new Types.ObjectId(),
			drillType: 'fill_blank',
			score: 62,
			maxScore: 100,
			startedAt: dayOffset(weekStartDate, 4),
			completedAt: dayOffset(weekStartDate, 4),
			timeSpent: 195,
			fillBlankResults: {
				items: [
					{
						sentence: 'She ___ to the meeting every week.',
						blanks: [
							{
								position: 1,
								selectedAnswer: 'go',
								correctAnswer: 'goes',
								isCorrect: false,
							},
						],
					},
				],
				totalBlanks: 1,
				correctBlanks: 0,
				score: 62,
			},
		},
		{
			learnerId: LEARNER_ID,
			drillId: new Types.ObjectId(),
			drillAssignmentId: new Types.ObjectId(),
			drillType: 'free_talk',
			score: 68,
			maxScore: 100,
			startedAt: dayOffset(weekStartDate, 5),
			completedAt: dayOffset(weekStartDate, 5),
			timeSpent: 420,
		},
	];

	const insertedDrills = await DrillAttemptModel.insertMany(drillAttempts);
	console.log(`Inserted ${insertedDrills.length} DrillAttempt documents:`);
	insertedDrills.forEach((d) =>
		console.log(`  [${d.drillType}] score=${d.score} completedAt=${d.completedAt?.toISOString()}`)
	);

	// ── Pronunciation attempts ────────────────────────────────────────────────

	const pronunciationAttempts = [
		{
			learnerId: LEARNER_ID,
			textScore: 62,
			fluencyScore: 58,
			passed: false,
			passingThreshold: 70,
			incorrectPhonemes: ['th', 'v', 'r'],
			wordScores: [
				{ word: 'through', score: 55 },
				{ word: 'value', score: 60 },
				{ word: 'river', score: 58 },
			],
			attemptNumber: 1,
			createdAt: dayOffset(weekStartDate, 2),
		},
		{
			learnerId: LEARNER_ID,
			textScore: 62,
			fluencyScore: 58,
			passed: false,
			passingThreshold: 70,
			incorrectPhonemes: ['th', 'v', 'r'],
			wordScores: [
				{ word: 'through', score: 57 },
				{ word: 'value', score: 62 },
				{ word: 'river', score: 60 },
			],
			attemptNumber: 2,
			createdAt: dayOffset(weekStartDate, 4),
		},
	];

	const insertedPron = await PronunciationAttemptModel.insertMany(pronunciationAttempts);
	console.log(`Inserted ${insertedPron.length} PronunciationAttempt documents:`);
	insertedPron.forEach((p) =>
		console.log(
			`  textScore=${p.textScore} fluencyScore=${p.fluencyScore} passed=${p.passed} createdAt=${p.createdAt?.toISOString()}`
		)
	);

	await disconnectFromDatabase();
	console.log('Done.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
