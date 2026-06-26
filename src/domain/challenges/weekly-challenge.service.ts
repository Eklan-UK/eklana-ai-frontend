import { Types } from 'mongoose';
import WeeklyChallengeModel, { type IWeeklyChallenge } from '@/models/weekly-challenge';
import { aggregateWeaknesses } from './weakness-aggregator';
import { generateWeeklyChallenge } from './challenge-generator';
import { ChallengeRepository } from './challenge.repository';
import { ChallengeService } from './challenge.service';
import { currentWeekStartUtc, isSundayUtc } from '@/lib/challenges/utc-week-challenge';
import type { ChallengeDrillItem } from './types';

const challengeService = new ChallengeService(new ChallengeRepository());

const EMPTY_SUMMARY =
	'Complete drills Monday through Saturday to unlock your personalized challenge on Sunday.';

export interface WeeklyChallengeListItem {
	index: number;
	itemId: string;
	drillType: string;
	label: string;
	instructions: string;
	estimatedMinutes: number;
	completed: boolean;
}

export interface WeeklyChallengeListResponse {
	challengeId: string | null;
	weekStartDate: string;
	generatedAt?: string | null;
	weekNumber?: number;
	status: 'ready' | 'generating' | 'failed' | 'unavailable';
	summaryMessage: string;
	totalEstimatedMinutes: number;
	drillSequence: WeeklyChallengeListItem[];
	isSunday: boolean;
}

export interface WeeklyChallengeHistoryResponse {
	challenges: WeeklyChallengeListResponse[];
}

export interface WeeklyChallengeItemResponse {
	challengeId: string;
	itemId: string;
	weekStartDate: string;
	index: number;
	item: ChallengeDrillItem;
	completed: boolean;
}

export interface WeeklyChallengeCompleteResponse {
	challengeId: string;
	itemId: string;
	index: number;
	completed: boolean;
	completedItemIndexes: number[];
	totalItems: number;
}

export function toListResponse(
	doc: IWeeklyChallenge | null,
	now: Date,
	options?: { weekStartDate?: Date; weekNumber?: number },
): WeeklyChallengeListResponse {
	const isSunday = isSundayUtc(now);
	const fallbackWeekStart = options?.weekStartDate ?? currentWeekStartUtc(now);

	if (!doc) {
		return {
			challengeId: null,
			weekStartDate: fallbackWeekStart.toISOString(),
			generatedAt: null,
			weekNumber: options?.weekNumber,
			status: 'unavailable',
			summaryMessage: EMPTY_SUMMARY,
			totalEstimatedMinutes: 0,
			drillSequence: [],
			isSunday,
		};
	}

	const challengeId = doc._id.toString();
	const completedSet = new Set(doc.completedItemIndexes ?? []);
	const drillSequence = (doc.content?.drillSequence ?? []).map((item, index) => ({
		index,
		itemId: `${challengeId}-${index}`,
		drillType: item.drillType,
		label: item.targetWeakness.label,
		instructions: item.instructions,
		estimatedMinutes: item.estimatedMinutes,
		completed: completedSet.has(index),
	}));

	return {
		challengeId,
		weekStartDate: doc.weekStartDate.toISOString(),
		generatedAt: doc.generatedAt ? doc.generatedAt.toISOString() : null,
		weekNumber: options?.weekNumber,
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

function checkCasualOptions(content: WeeklyChallengeListResponse['drillSequence']): void {
	const casualPhrases = ["what's up", "see you", "how's it going", "hey,"];
	
	// Access drillSequence from generated content via the provided list response mapping
	// In the actual service doc, we need to check doc.content.drillSequence
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
		
		// ─── Post-processing: Check for casual options ──────────────────────────
		const casualPhrases = ["what's up", "see you", "how's it going", "hey,"];
		generatedContent.drillSequence.forEach((drill: any, drillIdx: number) => {
			if (drill.drillType === 'key_phrases' && drill.generatedContent?.key_phrase_items) {
				drill.generatedContent.key_phrase_items.forEach((item: any, itemIdx: number) => {
					const hasCasual = (item.options || []).some((opt: string) => 
						casualPhrases.some(phrase => opt.toLowerCase().includes(phrase.toLowerCase()))
					);
					if (hasCasual) {
						console.warn(`[WeeklyChallenge] Casual phrase detected in key_phrase_item`, {
							drillIdx,
							itemIdx,
							prompt: item.prompt,
						});
					}
				});
			}
		});
		// ────────────────────────────────────────────────────────────────────────

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

function normalizeWeekStartDate(weekStartDate: Date): Date {
	const normalized = new Date(weekStartDate);
	normalized.setUTCHours(0, 0, 0, 0);
	return normalized;
}

function assignWeekNumbers(
	docs: IWeeklyChallenge[],
): Map<string, number> {
	const sorted = [...docs].sort(
		(a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime(),
	);
	const weekNumbers = new Map<string, number>();
	let counter = 0;
	sorted.forEach((doc) => {
		const hasDrills = (doc.content?.drillSequence?.length ?? 0) > 0;
		if (hasDrills) {
			weekNumbers.set(doc.weekStartDate.toISOString(), ++counter);
		} else {
			weekNumbers.set(doc.weekStartDate.toISOString(), 0);
		}
	});
	return weekNumbers;
}

async function ensureCurrentWeekChallenge(
	learnerId: Types.ObjectId,
	now: Date = new Date(),
): Promise<void> {
	const currentWeek = currentWeekStartUtc(now);
	try {
		await challengeService.getOrGenerateChallenge(learnerId, currentWeek);
	} catch {
		// Generation may fail; history should still return existing weeks
	}
	if (isSundayUtc(now)) {
		await getOrCreateWeeklyChallenge(learnerId, now);
	}
}

export async function getWeeklyChallengeHistory(
	learnerId: Types.ObjectId,
	now: Date = new Date(),
): Promise<WeeklyChallengeHistoryResponse> {
	await ensureCurrentWeekChallenge(learnerId, now);

	const docs = await WeeklyChallengeModel.find({
		learnerId,
		status: { $in: ['ready', 'generating', 'failed'] },
	})
		.sort({ weekStartDate: -1 })
		.exec();

	const weekNumbers = assignWeekNumbers(docs);

	const challenges = docs.map((doc) =>
		toListResponse(doc, now, {
			weekNumber: weekNumbers.get(doc.weekStartDate.toISOString()),
		}),
	);

	return { challenges };
}

export async function getWeeklyChallengeForWeek(
	learnerId: Types.ObjectId,
	weekStartDate: Date,
	now: Date = new Date(),
): Promise<WeeklyChallengeListResponse> {
	const normalizedWeek = normalizeWeekStartDate(weekStartDate);
	const currentWeek = currentWeekStartUtc(now);

	if (normalizedWeek.getTime() === currentWeek.getTime()) {
		await ensureCurrentWeekChallenge(learnerId, now);
	}

	const doc = await WeeklyChallengeModel.findOne({
		learnerId,
		weekStartDate: normalizedWeek,
	});

	const allDocs = await WeeklyChallengeModel.find({
		learnerId,
		status: { $in: ['ready', 'generating', 'failed'] },
	}).exec();
	const weekNumbers = assignWeekNumbers(allDocs);

	return toListResponse(doc, now, {
		weekStartDate: normalizedWeek,
		weekNumber: doc
			? weekNumbers.get(doc.weekStartDate.toISOString())
			: undefined,
	});
}

export async function getWeeklyChallengeItem(
	learnerId: Types.ObjectId,
	index: number,
	weekStartDate?: Date,
	now: Date = new Date(),
	challengeId?: string,
): Promise<WeeklyChallengeItemResponse | null> {
	let doc: IWeeklyChallenge | null = null;

	if (challengeId && Types.ObjectId.isValid(challengeId)) {
		doc = await WeeklyChallengeModel.findOne({
			_id: new Types.ObjectId(challengeId),
			learnerId,
		});
	} else {
		const resolvedWeekStart = normalizeWeekStartDate(
			weekStartDate ?? currentWeekStartUtc(now),
		);
		doc = await WeeklyChallengeModel.findOne({
			learnerId,
			weekStartDate: resolvedWeekStart,
		});
	}

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
		itemId: `${doc._id.toString()}-${index}`,
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
	weekStartDate?: Date,
	now: Date = new Date(),
	challengeId?: string,
): Promise<WeeklyChallengeCompleteResponse | null> {
	let doc: IWeeklyChallenge | null = null;

	if (challengeId && Types.ObjectId.isValid(challengeId)) {
		doc = await WeeklyChallengeModel.findOne({
			_id: new Types.ObjectId(challengeId),
			learnerId,
		});
	} else {
		const resolvedWeekStart = normalizeWeekStartDate(
			weekStartDate ?? currentWeekStartUtc(now),
		);
		doc = await WeeklyChallengeModel.findOne({
			learnerId,
			weekStartDate: resolvedWeekStart,
		});
	}

	if (!doc || doc.status !== 'ready') {
		return null;
	}

	const totalItems = doc.content?.drillSequence?.length ?? 0;
	if (index < 0 || index >= totalItems) {
		return null;
	}

	const updated = await WeeklyChallengeModel.findOneAndUpdate(
		{ _id: doc._id, status: 'ready' },
		{ $addToSet: { completedItemIndexes: index } },
		{ new: true },
	);

	if (!updated) {
		return null;
	}

	return {
		challengeId: updated._id.toString(),
		itemId: `${updated._id.toString()}-${index}`,
		index,
		completed: true,
		completedItemIndexes: updated.completedItemIndexes ?? [],
		totalItems,
	};
}
