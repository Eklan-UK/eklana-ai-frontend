import { Types } from 'mongoose';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import { logger } from '@/lib/api/logger';
import {
	extractPhonemesFromReviewSnapshot,
	type PerformanceReviewSnapshot,
} from './pronunciation-phoneme-utils';

export interface PersistPhonemesFromDrillSnapshotParams {
	learnerId: string | Types.ObjectId;
	drillAttemptId: string | Types.ObjectId;
	drillId?: string | Types.ObjectId;
	snapshot: PerformanceReviewSnapshot | Record<string, unknown>;
	passThreshold?: number;
	drillType?: string;
}

/**
 * Persist one summary PronunciationAttempt per drill completion, derived from
 * performanceReviewSnapshot phoneme data. Idempotent on drillAttemptId.
 */
export async function persistPhonemesFromDrillSnapshot(
	params: PersistPhonemesFromDrillSnapshotParams
): Promise<{ created: boolean; attemptId?: string }> {
	const drillAttemptOid = new Types.ObjectId(params.drillAttemptId);
	const learnerOid = new Types.ObjectId(params.learnerId);
	const passThreshold = params.passThreshold ?? 70;

	const existing = await PronunciationAttempt.findOne({ drillAttemptId: drillAttemptOid })
		.select('_id')
		.lean()
		.exec();

	if (existing) {
		return { created: false, attemptId: existing._id.toString() };
	}

	const extracted = extractPhonemesFromReviewSnapshot(params.snapshot, passThreshold);

	if (extracted.incorrectPhonemes.length === 0 && extracted.incorrectLetters.length === 0) {
		return { created: false };
	}

	const attemptData: Record<string, unknown> = {
		learnerId: learnerOid,
		drillAttemptId: drillAttemptOid,
		textScore: extracted.textScore,
		passed: extracted.textScore >= passThreshold,
		passingThreshold: passThreshold,
		wordScores: extracted.wordScores,
		incorrectPhonemes: extracted.incorrectPhonemes,
		incorrectLetters: extracted.incorrectLetters,
		attemptNumber: 1,
	};

	if (params.drillId && Types.ObjectId.isValid(String(params.drillId))) {
		attemptData.drillId = new Types.ObjectId(params.drillId);
	}
	if (params.drillType) {
		attemptData.drillType = params.drillType;
	}

	try {
		const attempt = await PronunciationAttempt.create(attemptData);
		return { created: true, attemptId: attempt._id.toString() };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn('Failed to persist drill phoneme summary attempt', {
			drillAttemptId: drillAttemptOid.toString(),
			learnerId: learnerOid.toString(),
			error: message,
		});
		return { created: false };
	}
}
