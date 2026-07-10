import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import PronunciationAttempt from '@/models/pronunciation-attempt';
import { persistPhonemesFromDrillSnapshot } from './drill-phoneme-persistence.service';

const LEARNER_ID = '507f1f77bcf86cd799439011';
const DRILL_ATTEMPT_ID = '507f1f77bcf86cd799439012';
const DRILL_ID = '507f1f77bcf86cd799439013';
const EXISTING_ATTEMPT_ID = '507f1f77bcf86cd799439088';

const SNAPSHOT = {
	passThreshold: 70,
	groups: [
		{
			rows: [
				{
					text: 'think',
					textScore: {
						word_score_list: [
							{
								word: 'think',
								quality_score: 65,
								phone_score_list: [{ phone: 'TH', quality_score: 50 }],
							},
						],
					},
				},
			],
		},
	],
};

type FindOneFn = typeof PronunciationAttempt.findOne;
type CreateFn = typeof PronunciationAttempt.create;

describe('persistPhonemesFromDrillSnapshot', () => {
	let originalFindOne: FindOneFn;
	let originalCreate: CreateFn;
	let findOneExec: ReturnType<typeof mock.fn>;
	let createMock: ReturnType<typeof mock.fn>;

	beforeEach(() => {
		originalFindOne = PronunciationAttempt.findOne.bind(PronunciationAttempt);
		originalCreate = PronunciationAttempt.create.bind(PronunciationAttempt);

		findOneExec = mock.fn(async () => null);
		createMock = mock.fn(async (data: Record<string, unknown>) => ({
			_id: new Types.ObjectId('507f1f77bcf86cd799439099'),
			...data,
		}));

		PronunciationAttempt.findOne = (() => ({
			select: () => ({
				lean: () => ({
					exec: findOneExec,
				}),
			}),
		})) as unknown as FindOneFn;

		PronunciationAttempt.create = createMock as unknown as CreateFn;
	});

	afterEach(() => {
		PronunciationAttempt.findOne = originalFindOne;
		PronunciationAttempt.create = originalCreate;
	});

	it('creates a summary PronunciationAttempt when none exists for drillAttemptId', async () => {
		const result = await persistPhonemesFromDrillSnapshot({
			learnerId: LEARNER_ID,
			drillAttemptId: DRILL_ATTEMPT_ID,
			drillId: DRILL_ID,
			snapshot: SNAPSHOT,
			drillType: 'pronunciation',
		});

		assert.equal(result.created, true);
		assert.ok(result.attemptId);
		assert.equal(createMock.mock.callCount(), 1);

		const payload = createMock.mock.calls[0]?.arguments[0] as Record<string, unknown>;
		assert.equal(String(payload.drillAttemptId), DRILL_ATTEMPT_ID);
		assert.deepEqual(payload.incorrectPhonemes, ['TH']);
		assert.equal(payload.drillType, 'pronunciation');
	});

	it('is idempotent and skips insert when drillAttemptId already exists', async () => {
		findOneExec.mock.mockImplementation(async () => ({
			_id: new Types.ObjectId(EXISTING_ATTEMPT_ID),
		}));

		const result = await persistPhonemesFromDrillSnapshot({
			learnerId: LEARNER_ID,
			drillAttemptId: DRILL_ATTEMPT_ID,
			snapshot: SNAPSHOT,
		});

		assert.equal(result.created, false);
		assert.equal(result.attemptId, EXISTING_ATTEMPT_ID);
		assert.equal(createMock.mock.callCount(), 0);
	});
});
