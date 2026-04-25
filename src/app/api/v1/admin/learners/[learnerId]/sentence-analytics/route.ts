// GET /api/v1/admin/learners/[learnerId]/sentence-analytics
// Aggregate sentence-writing drill attempt stats for a learner (admin or assigned tutor)
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

type SentSlot = {
	globalIndex: number;
	wordIndex: number;
	learnerText: string;
	sentIndexField: number;
};

function flattenSentenceSlots(sr: {
	word?: string;
	definition?: string;
	sentences?: Array<{ text?: string; index?: number }>;
	words?: Array<{
		word?: string;
		sentences?: Array<{ text?: string; index?: number }>;
	}>;
}): SentSlot[] {
	const useWords = sr.words && Array.isArray(sr.words) && sr.words.length > 0;
	const words: Array<{
		word?: string;
		definition?: string;
		sentences?: Array<{ text?: string; index?: number }>;
	}> = useWords && sr.words
		? [...sr.words]
		: [{ word: sr.word, definition: sr.definition, sentences: sr.sentences || [] }];
	const slots: SentSlot[] = [];
	let g = 0;
	for (let wi = 0; wi < words.length; wi++) {
		const w = words[wi];
		const sents = w.sentences || [];
		for (let si = 0; si < sents.length; si++) {
			const sent = sents[si];
			slots.push({
				globalIndex: g,
				wordIndex: wi,
				learnerText: String(sent.text ?? ''),
				sentIndexField: typeof sent.index === 'number' ? sent.index : si,
			});
			g++;
		}
	}
	return slots;
}

function findSlotForReview(slots: SentSlot[], sentenceIndex: number): SentSlot | undefined {
	const byGlobal = slots.find((x) => x.globalIndex === sentenceIndex);
	if (byGlobal) return byGlobal;
	return slots.find((x) => x.sentIndexField === sentenceIndex);
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
			sentenceResults: { $exists: true, $ne: null },
			$or: [
				{ 'sentenceResults.sentences.0': { $exists: true } },
				{ 'sentenceResults.words.0': { $exists: true } },
			],
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
			.select('sentenceResults completedAt')
			.lean()
			.exec();

		let attemptsWithSentenceSlots = 0;
		// Sum of sentence slots across all sentence-writing attempts (same "volume" idea as grammar patterns sum)
		let totalAssignedTargets = 0;
		let correctSentence = 0;
		let incorrectSentence = 0;

		type ProblemRowAgg = { id: string; areaLabel: string; sentence: string; count: number };
		type FeedbackRowAgg = { id: string; label: string; sentence: string; count: number };
		const problemMap = new Map<string, ProblemRowAgg>();
		const feedbackMap = new Map<string, FeedbackRowAgg>();

		for (const att of attempts) {
			const sr = att.sentenceResults as
				| {
						word?: string;
						definition?: string;
						sentences?: Array<{ text?: string; index?: number }>;
						words?: Array<{
							word?: string;
							sentences?: Array<{ text?: string; index?: number }>;
						}>;
						reviewStatus?: string;
						sentenceReviews?: Array<{
							sentenceIndex: number;
							isCorrect: boolean;
							correctedText?: string;
						}>;
				  }
				| undefined;

			if (!sr) continue;

			const slots = flattenSentenceSlots(sr);
			if (slots.length === 0) continue;

			attemptsWithSentenceSlots += 1;
			totalAssignedTargets += slots.length;

			if (sr.reviewStatus !== 'reviewed' || !sr.sentenceReviews?.length) {
				continue;
			}

			for (const rev of sr.sentenceReviews) {
				const slot = findSlotForReview(slots, rev.sentenceIndex);
				const learnerText = (slot?.learnerText ?? '').trim();
				const wordIdx = slot?.wordIndex ?? 0;
				const areaLabel = `Target Word ${wordIdx + 1} - Sentence`;

				if (rev.isCorrect) {
					correctSentence += 1;
					const display = learnerText || '(empty)';
					const key = `ok:${display}`;
					const prev = feedbackMap.get(key);
					feedbackMap.set(key, {
						id: key,
						label: 'Correct sentence',
						sentence: display,
						count: (prev?.count ?? 0) + 1,
					});
				} else {
					incorrectSentence += 1;
					const pkey = `w:${wordIdx}:${learnerText}`;
					const pprev = problemMap.get(pkey);
					problemMap.set(pkey, {
						id: pkey,
						areaLabel,
						sentence: learnerText || '(empty)',
						count: (pprev?.count ?? 0) + 1,
					});

					const corrected = rev.correctedText && String(rev.correctedText).trim();
					if (corrected) {
						const fkey = `fc:${corrected}`;
						const fprev = feedbackMap.get(fkey);
						feedbackMap.set(fkey, {
							id: fkey,
							label: 'Correct sentence',
							sentence: corrected,
							count: (fprev?.count ?? 0) + 1,
						});
					}
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
			(a) => (a.sentenceResults as { reviewStatus?: string })?.reviewStatus === 'reviewed'
		);

		return NextResponse.json(
			{
				code: 'Success',
				data: {
					totalAssignedTargets,
					correctSentence,
					incorrectSentence,
					problemRows,
					feedbackRows,
					hasReviewedData,
					attemptsConsidered: attemptsWithSentenceSlots,
				},
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : 'Server error';
		logger.error('GET admin/learners/.../sentence-analytics', { error: msg });
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
