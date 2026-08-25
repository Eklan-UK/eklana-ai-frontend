import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import TutorAssignment from '@/models/tutor-assignment';
import Profile from '@/models/profile';
import {
	assertStaffCanActOnLearners,
	assertStaffCanReadLearner,
	resolveTutorScopedLearnerIds,
} from './staff-learner-access';

const TUTOR_ID = new Types.ObjectId('507f1f77bcf86cd799439011');
const LEARNER_A = '507f1f77bcf86cd799439021';
const LEARNER_B = '507f1f77bcf86cd799439022';
const LEARNER_C = '507f1f77bcf86cd799439023';

const tutorCtx = { userId: TUTOR_ID, userRole: 'tutor' };
const adminCtx = { userId: TUTOR_ID, userRole: 'admin' };

function execChain(result: unknown) {
	const chain: Record<string, unknown> = {};
	const next = () => chain;
	chain.select = next;
	chain.sort = next;
	chain.lean = next;
	chain.exec = async () => result;
	return chain;
}

describe('staff-learner-access', () => {
	const originalFindOne = TutorAssignment.findOne.bind(TutorAssignment);
	const originalFind = TutorAssignment.find.bind(TutorAssignment);
	const originalProfileFindOne = Profile.findOne.bind(Profile);
	const originalProfileFind = Profile.find.bind(Profile);

	let assignedIds: string[];

	beforeEach(() => {
		assignedIds = [LEARNER_A, LEARNER_B];

		TutorAssignment.findOne = mock.fn((query: { learnerId?: Types.ObjectId }) => {
			const id = query.learnerId?.toString();
			return execChain(id && assignedIds.includes(id) ? { _id: 'assigned' } : null);
		}) as typeof TutorAssignment.findOne;

		TutorAssignment.find = mock.fn(() =>
			execChain(
				assignedIds.map((id) => ({
					learnerId: new Types.ObjectId(id),
					assignedAt: new Date('2026-08-01T00:00:00.000Z'),
				}))
			)
		) as typeof TutorAssignment.find;

		Profile.findOne = mock.fn(() => execChain(null)) as typeof Profile.findOne;
		Profile.find = mock.fn(() => execChain([])) as typeof Profile.find;
	});

	afterEach(() => {
		TutorAssignment.findOne = originalFindOne;
		TutorAssignment.find = originalFind;
		Profile.findOne = originalProfileFindOne;
		Profile.find = originalProfileFind;
	});

	describe('assertStaffCanActOnLearners', () => {
		it('allows admin for any learner IDs without checking assignments', async () => {
			const result = await assertStaffCanActOnLearners(adminCtx, [LEARNER_C]);
			assert.equal(result, 'ok');
			assert.equal((TutorAssignment.findOne as ReturnType<typeof mock.fn>).mock.calls.length, 0);
		});

		it('allows tutor when every ID is assigned', async () => {
			const result = await assertStaffCanActOnLearners(tutorCtx, [LEARNER_A, LEARNER_B]);
			assert.equal(result, 'ok');
		});

		it('forbids tutor when any ID is not assigned', async () => {
			const result = await assertStaffCanActOnLearners(tutorCtx, [LEARNER_A, LEARNER_C]);
			assert.equal(result, 'forbidden');
		});

		it('forbids non-staff roles', async () => {
			const result = await assertStaffCanActOnLearners(
				{ userId: TUTOR_ID, userRole: 'user' },
				[LEARNER_A]
			);
			assert.equal(result, 'forbidden');
		});
	});

	describe('resolveTutorScopedLearnerIds', () => {
		it('returns requested IDs as-is for admin', async () => {
			const result = await resolveTutorScopedLearnerIds(adminCtx, [LEARNER_C]);
			assert.deepEqual(result, { ok: true, learnerIds: [LEARNER_C] });
			assert.equal((TutorAssignment.find as ReturnType<typeof mock.fn>).mock.calls.length, 0);
		});

		it('returns undefined learnerIds for admin when omitted', async () => {
			const result = await resolveTutorScopedLearnerIds(adminCtx);
			assert.deepEqual(result, { ok: true, learnerIds: undefined });
		});

		it('returns the full roster for tutor when IDs are omitted', async () => {
			const result = await resolveTutorScopedLearnerIds(tutorCtx);
			assert.deepEqual(result, { ok: true, learnerIds: [LEARNER_A, LEARNER_B] });
		});

		it('returns requested IDs for tutor when all are on the roster', async () => {
			const result = await resolveTutorScopedLearnerIds(tutorCtx, [LEARNER_A]);
			assert.deepEqual(result, { ok: true, learnerIds: [LEARNER_A] });
		});

		it('forbids tutor when any requested ID is outside the roster', async () => {
			const result = await resolveTutorScopedLearnerIds(tutorCtx, [LEARNER_A, LEARNER_C]);
			assert.deepEqual(result, { ok: false });
		});
	});

	describe('assertStaffCanReadLearner', () => {
		it('allows admin without checking assignment', async () => {
			const result = await assertStaffCanReadLearner(adminCtx, LEARNER_C);
			assert.equal(result, 'ok');
			assert.equal((TutorAssignment.findOne as ReturnType<typeof mock.fn>).mock.calls.length, 0);
		});

		it('allows tutor for an assigned learner', async () => {
			const result = await assertStaffCanReadLearner(tutorCtx, LEARNER_A);
			assert.equal(result, 'ok');
		});

		it('forbids tutor for an unassigned learner', async () => {
			const result = await assertStaffCanReadLearner(tutorCtx, LEARNER_C);
			assert.equal(result, 'forbidden');
		});
	});
});
