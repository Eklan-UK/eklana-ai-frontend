// GET /api/v1/admin/learners/[learnerId]/grammar-analytics
// Aggregate grammar drill attempt stats for a learner (admin or assigned tutor)
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

const MAX_BREAKDOWN_ROWS = 20;

function learnerSentenceText(
	patterns: Array<{ sentences?: Array<{ text?: string; index?: number }> }>,
	patternIndex: number,
	sentenceIndex: number
): string {
	const p = patterns[patternIndex];
	if (!p?.sentences?.length) return '';
	const arr = p.sentences;
	const byIdx = arr.find((s) => s.index === sentenceIndex);
	if (byIdx?.text) return byIdx.text;
	return arr[sentenceIndex]?.text ?? '';
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
			'grammarResults.patterns.0': { $exists: true },
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
			.select('grammarResults completedAt')
			.lean()
			.exec();

		// Sum of pattern slots across all grammar attempts (assigned / practiced volume)
		let totalAssignedPatterns = 0;
		let correctSentence = 0;
		let incorrectSentence = 0;

		type ProblemRowAgg = { id: string; patternLabel: string; sentence: string; count: number };
		type FeedbackRowAgg = { id: string; label: string; sentence: string; count: number };
		const problemMap = new Map<string, ProblemRowAgg>();
		const feedbackMap = new Map<string, FeedbackRowAgg>();

		for (const att of attempts) {
			const gr = att.grammarResults as
				| {
						patterns?: Array<{ sentences?: Array<{ text?: string; index?: number }> }>;
						reviewStatus?: string;
						patternReviews?: Array<{
							patternIndex: number;
							sentenceIndex: number;
							isCorrect: boolean;
							correctedText?: string;
						}>;
				  }
				| undefined;

			const patterns = gr?.patterns ?? [];
			totalAssignedPatterns += patterns.length;

			if (gr?.reviewStatus !== 'reviewed' || !gr.patternReviews?.length) {
				continue;
			}

			for (const rev of gr.patternReviews) {
				const learnerText = learnerSentenceText(patterns, rev.patternIndex, rev.sentenceIndex);
				const patternLabel = `Pattern ${rev.patternIndex + 1} - Sentence`;

				if (rev.isCorrect) {
					correctSentence += 1;
					const display =
						rev.correctedText && String(rev.correctedText).trim().length > 0
							? String(rev.correctedText).trim()
							: learnerText.trim();
					const key = `c:${display}`;
					const prev = feedbackMap.get(key);
					feedbackMap.set(key, {
						id: key,
						label: 'Correct sentence',
						sentence: display,
						count: (prev?.count ?? 0) + 1,
					});
				} else {
					incorrectSentence += 1;
					const key = `w:${rev.patternIndex}:${learnerText.trim()}`;
					const prev = problemMap.get(key);
					problemMap.set(key, {
						id: key,
						patternLabel,
						sentence: learnerText.trim() || '(empty)',
						count: (prev?.count ?? 0) + 1,
					});
				}
			}
		}

		const problemRows = [...problemMap.values()]
			.sort((a, b) => b.count - a.count)
			.slice(0, MAX_BREAKDOWN_ROWS);

		const feedbackRows = [...feedbackMap.values()]
			.sort((a, b) => b.count - a.count)
			.slice(0, MAX_BREAKDOWN_ROWS);

		const hasReviewedData = attempts.some(
			(a) => (a.grammarResults as { reviewStatus?: string })?.reviewStatus === 'reviewed'
		);

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					totalAssignedPatterns,
					correctSentence,
					incorrectSentence,
					problemRows,
					feedbackRows,
					hasReviewedData,
					attemptsConsidered: attempts.length,
				},
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : 'Server error';
		logger.error('GET admin/learners/.../grammar-analytics', { error: msg });
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
