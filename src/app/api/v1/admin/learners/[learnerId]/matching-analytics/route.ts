// GET /api/v1/admin/learners/[learnerId]/matching-analytics
// Aggregate matching drill attempts for a learner (admin or assigned tutor)
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import { Types } from 'mongoose';
import DrillAttempt from '@/models/drill-attempt';
import { logger } from '@/lib/api/logger';
import {
	assertStaffCanReadLearner,
	resolveLearnerIdToUserIdString,
} from '@/lib/api/staff-learner-access';

const MAX_CONFUSION_ROWS = 20;

type MatchingResultsLean = {
	pairsMatched?: number;
	totalPairs?: number;
	accuracy?: number;
	incorrectPairs?: Array<{ left?: string; right?: string; attemptedMatch?: string }>;
	pairMatchEvents?: Array<{ durationSec?: number; left?: string; right?: string }>;
};

/** Split durations into fast (< median) vs slow (>= median). Ties at median count as slow. */
function splitByMedian(durations: number[]): { fast: number; slow: number } {
	if (durations.length === 0) return { fast: 0, slow: 0 };
	const sorted = [...durations].sort((a, b) => a - b);
	const n = sorted.length;
	const median =
		n % 2 === 1
			? sorted[Math.floor(n / 2)]
			: (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
	let fast = 0;
	let slow = 0;
	for (const d of durations) {
		if (d < median) fast++;
		else slow++;
	}
	return { fast, slow };
}

async function handler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { learnerId: string }
): Promise<NextResponse> {
	try {
		const { learnerId } = params;

		if (!learnerId || !Types.ObjectId.isValid(learnerId)) {
			return NextResponse.json(
				{ code: 'ValidationError', message: 'Invalid learner ID' },
				{ status: 400 }
			);
		}

		await connectToDatabase();

		const canonicalLearnerId = await resolveLearnerIdToUserIdString(learnerId);
		const access = await assertStaffCanReadLearner(context, canonicalLearnerId);
		if (access === 'forbidden') {
			return NextResponse.json(
				{ code: 'NotFound', message: 'Learner not found or access denied' },
				{ status: 404 }
			);
		}

		const { searchParams } = new URL(req.url);
		const from = searchParams.get('from');
		const to = searchParams.get('to');

		const learnerOid = new Types.ObjectId(canonicalLearnerId);
		const filter: Record<string, unknown> = {
			learnerId: learnerOid,
			'matchingResults.totalPairs': { $gt: 0 },
		};

		if (from || to) {
			const range: { $gte?: Date; $lte?: Date } = {};
			if (from) {
				const d = new Date(from);
				if (!Number.isNaN(d.getTime())) range.$gte = d;
			}
			if (to) {
				const d = new Date(to);
				if (!Number.isNaN(d.getTime())) range.$lte = d;
			}
			if (Object.keys(range).length > 0) {
				filter.completedAt = range;
			}
		}

		const attempts = await DrillAttempt.find(filter)
			.select('matchingResults completedAt')
			.lean();

		let sumTotalPairs = 0;
		let sumPairsMatched = 0;
		let totalAttempts = 0;

		const confusionMap = new Map<
			string,
			{ left: string; attemptedMatch: string; correctRight: string; count: number }
		>();

		const allDurations: number[] = [];
		let slowest: { durationSec: number; left: string; right: string } | null = null;
		let timingFirstCompletedAt: Date | null = null;

		for (const a of attempts) {
			const m = a.matchingResults as MatchingResultsLean | undefined;
			if (!m || typeof m.totalPairs !== 'number' || m.totalPairs <= 0) continue;

			totalAttempts++;
			sumTotalPairs += m.totalPairs;
			sumPairsMatched += typeof m.pairsMatched === 'number' ? m.pairsMatched : 0;

			for (const ip of m.incorrectPairs ?? []) {
				const left = String(ip.left ?? '');
				const right = String(ip.right ?? '');
				const attemptedMatch = String(ip.attemptedMatch ?? '');
				const key = `${left}|${attemptedMatch}|${right}`;
				const prev = confusionMap.get(key);
				if (prev) prev.count++;
				else
					confusionMap.set(key, {
						left,
						attemptedMatch,
						correctRight: right,
						count: 1,
					});
			}

			const events = m.pairMatchEvents ?? [];
			if (events.length > 0 && a.completedAt) {
				const cd = new Date(a.completedAt as Date);
				if (!Number.isNaN(cd.getTime())) {
					if (!timingFirstCompletedAt || cd < timingFirstCompletedAt) {
						timingFirstCompletedAt = cd;
					}
				}
			}

			for (const ev of events) {
				if (typeof ev.durationSec !== 'number' || !Number.isFinite(ev.durationSec)) continue;
				allDurations.push(ev.durationSec);
				if (!slowest || ev.durationSec > slowest.durationSec) {
					slowest = {
						durationSec: ev.durationSec,
						left: String(ev.left ?? ''),
						right: String(ev.right ?? ''),
					};
				}
			}
		}

		const accuracyRatePct =
			sumTotalPairs > 0
				? Math.round((sumPairsMatched / sumTotalPairs) * 100)
				: 0;

		const confusions = [...confusionMap.entries()]
			.map(([key, v]) => ({
				id: key,
				left: v.left,
				attemptedMatch: v.attemptedMatch,
				correctRight: v.correctRight,
				count: v.count,
			}))
			.sort((a, b) => b.count - a.count)
			.slice(0, MAX_CONFUSION_ROWS);

		const { fast, slow } = splitByMedian(allDurations);

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					totalAssignedPairs: sumTotalPairs,
					totalAttempts,
					accuracyRatePct,
					confusions,
					fastMatches: fast,
					slowMatches: slow,
					slowestMatchSeconds: slowest?.durationSec ?? null,
					slowestMatchLabel:
						slowest && (slowest.left || slowest.right)
							? `${slowest.left} → ${slowest.right}`
							: null,
					hasPairTimingData: allDurations.length > 0,
					timingAvailableSince: timingFirstCompletedAt?.toISOString() ?? null,
					attemptsConsidered: totalAttempts,
				},
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : 'Server error';
		logger.error('GET admin/learners/.../matching-analytics', { error: msg });
		return NextResponse.json({ code: 'ServerError', message: msg }, { status: 500 });
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ learnerId: string }> }
) {
	const resolved = await params;
	return withRole(['admin', 'tutor'], (r, context) => handler(r, context, resolved))(req);
}
