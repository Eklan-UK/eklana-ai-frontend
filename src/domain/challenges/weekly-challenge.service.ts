import { Types } from 'mongoose';
import WeeklyChallengeModel, { type IWeeklyChallenge } from '@/models/weekly-challenge';
import { aggregateWeaknesses } from './weakness-aggregator';
import { generateWeeklyChallenge } from './challenge-generator';
import { currentWeekStartUtc, isSundayUtc } from '@/lib/challenges/utc-week-challenge';
import type { ChallengeDrillItem } from './types';

const EMPTY_SUMMARY =
	'Complete drills Monday through Saturday to unlock your personalized challenge on Sunday.';

export interface WeeklyChallengeListItem {
	index: number;
	drillType: string;
	label: string;
	instructions: string;
	estimatedMinutes: number;
	completed: boolean;
}

export interface WeeklyChallengeListResponse {
	challengeId: string | null;
	weekStartDate: string;
	status: 'ready' | 'generating' | 'failed' | 'unavailable';
	summaryMessage: string;
	totalEstimatedMinutes: number;
	drillSequence: WeeklyChallengeListItem[];
	isSunday: boolean;
}

export interface WeeklyChallengeItemResponse {
	challengeId: string;
	weekStartDate: string;
	index: number;
	item: ChallengeDrillItem;
	completed: boolean;
}

export interface WeeklyChallengeCompleteResponse {
	challengeId: string;
	index: number;
	completed: boolean;
	completedItemIndexes: number[];
	totalItems: number;
}

function toListResponse(
	doc: IWeeklyChallenge | null,
	now: Date,
): WeeklyChallengeListResponse {
	const isSunday = isSundayUtc(now);
	const weekStartDate = currentWeekStartUtc(now);

	if (!doc) {
		return {
			challengeId: null,
			weekStartDate: weekStartDate.toISOString(),
			status: 'unavailable',
			summaryMessage: EMPTY_SUMMARY,
			totalEstimatedMinutes: 0,
			drillSequence: [],
			isSunday,
		};
	}

	const completedSet = new Set(doc.completedItemIndexes ?? []);
	const drillSequence = (doc.content?.drillSequence ?? []).map((item, index) => ({
		index,
		drillType: item.drillType,
		label: item.targetWeakness.label,
		instructions: item.instructions,
		estimatedMinutes: item.estimatedMinutes,
		completed: completedSet.has(index),
	}));

	return {
		challengeId: doc._id.toString(),
		weekStartDate: doc.weekStartDate.toISOString(),
		status:
			doc.status === 'ready' || doc.status === 'generating' || doc.status === 'failed'
				? doc.status
				: 'unavailable',
		summaryMessage: doc.content?.summaryMessage ?? EMPTY_SUMMARY,
		totalEstimatedMinutes: doc.content?.totalEstimatedMinutes ?? 0,
		drillSequence,
		isSunday,
	};
}

async function runGeneration(
	learnerId: Types.ObjectId,
	weekStartDate: Date,
): Promise<IWeeklyChallenge> {
	const profile = await aggregateWeaknesses(learnerId, weekStartDate);

	if (profile.topWeaknesses.length === 0) {
		const readyDoc = await WeeklyChallengeModel.findOneAndUpdate(
			{ learnerId, weekStartDate, status: 'generating' },
			{
				$set: {
					status: 'ready',
					weaknessProfile: profile,
					content: {
						drillSequence: [],
						totalEstimatedMinutes: 0,
						summaryMessage: EMPTY_SUMMARY,
					},
					generatedAt: new Date(),
				},
			},
			{ new: true },
		);
		if (!readyDoc) {
			throw new Error('Weekly challenge generation lock lost');
		}
		return readyDoc;
	}

	try {
		const generatedContent = await generateWeeklyChallenge(profile);
		const readyDoc = await WeeklyChallengeModel.findOneAndUpdate(
			{ learnerId, weekStartDate, status: 'generating' },
			{
				$set: {
					status: 'ready',
					weaknessProfile: profile,
					content: generatedContent,
					generatedAt: new Date(),
				},
			},
			{ new: true },
		);
		if (!readyDoc) {
			throw new Error('Weekly challenge generation lock lost');
		}
		return readyDoc;
	} catch (error) {
		await WeeklyChallengeModel.findOneAndUpdate(
			{ learnerId, weekStartDate, status: 'generating' },
			{ $set: { status: 'failed' } },
		);
		throw error;
	}
}

async function tryAcquireGenerationLock(
	learnerId: Types.ObjectId,
	weekStartDate: Date,
): Promise<IWeeklyChallenge | null> {
	const existing = await WeeklyChallengeModel.findOne({ learnerId, weekStartDate });
	if (existing) {
		if (existing.status === 'generating' || existing.status === 'ready') {
			return existing;
		}
		if (existing.status === 'failed' || existing.status === 'pending') {
			const locked = await WeeklyChallengeModel.findOneAndUpdate(
				{
					learnerId,
					weekStartDate,
					status: { $in: ['failed', 'pending'] },
				},
				{ $set: { status: 'generating' } },
				{ new: true },
			);
			return locked;
		}
		return existing;
	}

	try {
		const created = await WeeklyChallengeModel.create({
			learnerId,
			weekStartDate,
			status: 'generating',
			challengeType: 'structured_drill_sequence',
			content: {
				drillSequence: [],
				totalEstimatedMinutes: 0,
				summaryMessage: '',
			},
			completedItemIndexes: [],
		});
		return created;
	} catch (error: unknown) {
		const err = error as { code?: number };
		if (err?.code === 11000) {
			return WeeklyChallengeModel.findOne({ learnerId, weekStartDate });
		}
		throw error;
	}
}

export async function getOrCreateWeeklyChallenge(
	learnerId: Types.ObjectId,
	now: Date = new Date(),
): Promise<WeeklyChallengeListResponse> {
	const weekStartDate = currentWeekStartUtc(now);
	let doc = await WeeklyChallengeModel.findOne({ learnerId, weekStartDate });

	if (doc?.status === 'ready') {
		return toListResponse(doc, now);
	}

	if (!isSundayUtc(now)) {
		return toListResponse(doc, now);
	}

	if (doc?.status === 'generating') {
		return toListResponse(doc, now);
	}

	if (!doc || doc.status === 'failed' || doc.status === 'pending') {
		const locked = await tryAcquireGenerationLock(learnerId, weekStartDate);
		if (!locked) {
			return toListResponse(null, now);
		}

		if (locked.status === 'ready') {
			return toListResponse(locked, now);
		}

		if (locked.status === 'generating') {
			const isOwnLock =
				!doc ||
				doc.status === 'failed' ||
				doc.status === 'pending' ||
				locked._id.equals(doc._id);

			if (isOwnLock) {
				try {
					doc = await runGeneration(learnerId, weekStartDate);
				} catch {
					doc = await WeeklyChallengeModel.findOne({ learnerId, weekStartDate });
				}
			} else {
				doc = locked;
			}
		} else {
			doc = locked;
		}
	}

	return toListResponse(doc, now);
}

export async function getWeeklyChallengeItem(
	learnerId: Types.ObjectId,
	index: number,
	now: Date = new Date(),
): Promise<WeeklyChallengeItemResponse | null> {
	const weekStartDate = currentWeekStartUtc(now);
	const doc = await WeeklyChallengeModel.findOne({ learnerId, weekStartDate });

	if (!doc || doc.status !== 'ready') {
		return null;
	}

	const item = doc.content?.drillSequence?.[index];
	if (!item) {
		return null;
	}

	const completedSet = new Set(doc.completedItemIndexes ?? []);

	return {
		challengeId: doc._id.toString(),
		weekStartDate: doc.weekStartDate.toISOString(),
		index,
		item: item as ChallengeDrillItem,
		completed: completedSet.has(index),
	};
}

export async function markWeeklyChallengeItemComplete(
	learnerId: Types.ObjectId,
	index: number,
	_score?: number,
	now: Date = new Date(),
): Promise<WeeklyChallengeCompleteResponse | null> {
	const weekStartDate = currentWeekStartUtc(now);
	const doc = await WeeklyChallengeModel.findOne({ learnerId, weekStartDate });

	if (!doc || doc.status !== 'ready') {
		return null;
	}

	const totalItems = doc.content?.drillSequence?.length ?? 0;
	if (index < 0 || index >= totalItems) {
		return null;
	}

	const updated = await WeeklyChallengeModel.findOneAndUpdate(
		{ learnerId, weekStartDate, status: 'ready' },
		{ $addToSet: { completedItemIndexes: index } },
		{ new: true },
	);

	if (!updated) {
		return null;
	}

	return {
		challengeId: updated._id.toString(),
		index,
		completed: true,
		completedItemIndexes: updated.completedItemIndexes ?? [],
		totalItems,
	};
}
