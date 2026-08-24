import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ClinicEnrollmentService } from './clinic-enrollment.service';
import type { ClinicEnrollmentRepo } from './clinic-enrollment.service';
import type { ClinicEnrollmentRecord } from './clinic-enrollment.repository';
import { ValidationError } from '@/lib/api/response';

class FakeClinicEnrollmentRepository implements ClinicEnrollmentRepo {
  records = new Map<string, ClinicEnrollmentRecord>();
  upsertCalls: Array<{ learnerId: string; enrolledBy: string }> = [];
  withdrawCalls: string[] = [];

  async isLearnerEnrolled(learnerId: string): Promise<boolean> {
    return this.records.get(learnerId)?.status === 'active';
  }

  async findByLearnerId(
    learnerId: string,
  ): Promise<ClinicEnrollmentRecord | null> {
    return this.records.get(learnerId) ?? null;
  }

  async findActiveEnrollmentsForLearners(
    learnerIds: string[],
  ): Promise<ClinicEnrollmentRecord[]> {
    return learnerIds
      .map((id) => this.records.get(id))
      .filter((row): row is ClinicEnrollmentRecord => row?.status === 'active');
  }

  async findAllActiveEnrollments(): Promise<ClinicEnrollmentRecord[]> {
    return [...this.records.values()].filter((row) => row.status === 'active');
  }

  async findNotEnrolledLearnerIds(learnerIds: string[]): Promise<string[]> {
    return learnerIds.filter(
      (id) => this.records.get(id)?.status !== 'active',
    );
  }

  async upsertActiveEnrollment({
    learnerId,
    enrolledBy,
  }: {
    learnerId: string;
    enrolledBy: string;
  }): Promise<void> {
    this.upsertCalls.push({ learnerId, enrolledBy });
    this.records.set(learnerId, {
      learnerId,
      enrolledBy,
      enrolledAt: new Date('2026-08-21T12:00:00.000Z'),
      status: 'active',
    });
  }

  async withdrawEnrollment(learnerId: string): Promise<void> {
    this.withdrawCalls.push(learnerId);
    const existing = this.records.get(learnerId);
    if (existing?.status === 'active') {
      this.records.set(learnerId, { ...existing, status: 'withdrawn' });
    }
  }
}

describe('ClinicEnrollmentService.setLearnerEnrollment', () => {
  let repo: FakeClinicEnrollmentRepository;
  let service: ClinicEnrollmentService;

  beforeEach(() => {
    repo = new FakeClinicEnrollmentRepository();
    service = new ClinicEnrollmentService(repo);
  });

  it('enrolls a learner who has no record', async () => {
    const enrolled = await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-1',
    });

    assert.equal(enrolled, true);
    assert.equal(repo.upsertCalls.length, 1);
    assert.deepEqual(repo.upsertCalls[0], {
      learnerId: 'learner-1',
      enrolledBy: 'admin-1',
    });
    assert.equal(repo.records.get('learner-1')?.status, 'active');
  });

  it('withdraws an active enrollment', async () => {
    await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-1',
    });

    const enrolled = await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: false,
      enrolledBy: 'admin-1',
    });

    assert.equal(enrolled, false);
    assert.deepEqual(repo.withdrawCalls, ['learner-1']);
    assert.equal(repo.records.get('learner-1')?.status, 'withdrawn');
  });

  it('re-enrolls a withdrawn learner', async () => {
    await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-1',
    });
    await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: false,
      enrolledBy: 'admin-1',
    });

    const enrolled = await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-2',
    });

    assert.equal(enrolled, true);
    assert.equal(repo.upsertCalls.length, 2);
    assert.equal(repo.upsertCalls[1]?.enrolledBy, 'admin-2');
    assert.equal(repo.records.get('learner-1')?.status, 'active');
  });

  it('does not upsert when already enrolled', async () => {
    await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-1',
    });

    const enrolled = await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-2',
    });

    assert.equal(enrolled, true);
    assert.equal(repo.upsertCalls.length, 1);
  });

  it('does not withdraw when already locked', async () => {
    const enrolled = await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: false,
      enrolledBy: 'admin-1',
    });

    assert.equal(enrolled, false);
    assert.equal(repo.withdrawCalls.length, 0);
  });
});

describe('ClinicEnrollmentService.assertLearnersEnrolledForClinic', () => {
  let repo: FakeClinicEnrollmentRepository;
  let service: ClinicEnrollmentService;

  beforeEach(() => {
    repo = new FakeClinicEnrollmentRepository();
    service = new ClinicEnrollmentService(repo);
  });

  it('returns when the learner list is empty', async () => {
    await service.assertLearnersEnrolledForClinic({ learnerIds: [] });
  });

  it('returns when every learner is enrolled', async () => {
    await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-1',
    });
    await service.setLearnerEnrollment({
      learnerId: 'learner-2',
      enrolled: true,
      enrolledBy: 'admin-1',
    });

    await service.assertLearnersEnrolledForClinic({
      learnerIds: ['learner-1', 'learner-2'],
    });
  });

  it('throws when any learner is not enrolled', async () => {
    await service.setLearnerEnrollment({
      learnerId: 'learner-1',
      enrolled: true,
      enrolledBy: 'admin-1',
    });

    await assert.rejects(
      () =>
        service.assertLearnersEnrolledForClinic({
          learnerIds: ['learner-1', 'learner-2'],
        }),
      (error: unknown) => {
        assert.equal(error instanceof ValidationError, true);
        assert.match(
          (error as Error).message,
          /not enrolled in Precision Clinic/,
        );
        assert.match((error as Error).message, /learner-2/);
        return true;
      },
    );
  });
});
