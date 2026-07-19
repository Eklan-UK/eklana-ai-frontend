import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { buildDrillListQuery } from './drill.repository';
import { DrillService } from './drill.service';
import { ForbiddenError, NotFoundError } from '@/lib/api/response';
import type { Drill } from './drill.types';

const DRILL_ID = '507f1f77bcf86cd799439012';

function makeDrill(overrides: Partial<Drill> = {}): Drill {
  return {
    _id: new Types.ObjectId(DRILL_ID),
    title: 'Emergency vocab',
    type: 'vocabulary',
    difficulty: 'intermediate',
    date: new Date('2026-07-01T00:00:00.000Z'),
    duration_days: 1,
    created_by: 'admin@example.com',
    is_active: true,
    is_bookmarked: false,
    bookmarked_at: null,
    learning_journey_part: 1,
    learning_journey_topic: 'handling_emergency_critical',
    ...overrides,
  };
}

describe('buildDrillListQuery', () => {
  it('filters by isBookmarked true', () => {
    const query = buildDrillListQuery({ isBookmarked: true });
    assert.deepEqual(query, { is_bookmarked: true });
  });

  it('filters by isBookmarked false treating missing as false', () => {
    const query = buildDrillListQuery({ isBookmarked: false });
    assert.deepEqual(query, { is_bookmarked: { $ne: true } });
  });

  it('filters by learning journey part and topic', () => {
    const query = buildDrillListQuery({
      learningJourneyPart: 2,
      learningJourneyTopic: 'conducting_cpr',
    });
    assert.equal(query.learning_journey_part, 2);
    assert.equal(query.learning_journey_topic, 'conducting_cpr');
  });

  it('filters by type and title/context search', () => {
    const query = buildDrillListQuery({
      type: 'vocabulary',
      q: 'emergency',
    });
    assert.equal(query.type, 'vocabulary');
    assert.ok(Array.isArray(query.$and));
    const andClause = query.$and as Array<{ $or: Array<Record<string, RegExp>> }>;
    assert.equal(andClause.length, 1);
    assert.ok(andClause[0].$or[0].title.test('Emergency'));
    assert.ok(andClause[0].$or[1].context.test('emergency'));
  });

  it('combines bookmark + mission + type + search', () => {
    const query = buildDrillListQuery({
      isBookmarked: true,
      learningJourneyPart: 1,
      learningJourneyTopic: 'handling_emergency_critical',
      type: 'roleplay',
      q: 'ICU',
    });
    assert.equal(query.is_bookmarked, true);
    assert.equal(query.learning_journey_part, 1);
    assert.equal(query.learning_journey_topic, 'handling_emergency_critical');
    assert.equal(query.type, 'roleplay');
    assert.ok(Array.isArray(query.$and));
  });
});

describe('DrillService.setDrillBookmarked', () => {
  let findById: ReturnType<typeof mock.fn>;
  let update: ReturnType<typeof mock.fn>;
  let service: DrillService;

  beforeEach(() => {
    findById = mock.fn(async () => makeDrill());
    update = mock.fn(async (_id: string, data: Partial<Drill>) =>
      makeDrill({
        is_bookmarked: data.is_bookmarked,
        bookmarked_at: data.bookmarked_at ?? null,
      })
    );

    const drillRepo = {
      findById,
      update,
      findMany: mock.fn(async () => []),
      countMany: mock.fn(async () => 0),
    };

    service = new DrillService(
      drillRepo as never,
      {} as never,
      {} as never
    );
  });

  it('sets is_bookmarked and bookmarked_at when bookmarking', async () => {
    const before = Date.now();
    const drill = await service.setDrillBookmarked(DRILL_ID, true, {
      userId: 'admin-1',
      userRole: 'admin',
    });
    const after = Date.now();

    assert.equal(findById.mock.callCount(), 1);
    assert.equal(update.mock.callCount(), 1);
    const [, payload] = update.mock.calls[0]?.arguments as [string, Partial<Drill>];
    assert.equal(payload.is_bookmarked, true);
    assert.ok(payload.bookmarked_at instanceof Date);
    assert.ok(payload.bookmarked_at.getTime() >= before);
    assert.ok(payload.bookmarked_at.getTime() <= after);
    assert.equal(drill.is_bookmarked, true);
  });

  it('clears bookmarked_at when unbookmarking', async () => {
    const drill = await service.setDrillBookmarked(DRILL_ID, false, {
      userId: 'tutor-1',
      userRole: 'tutor',
    });

    const [, payload] = update.mock.calls[0]?.arguments as [string, Partial<Drill>];
    assert.equal(payload.is_bookmarked, false);
    assert.equal(payload.bookmarked_at, null);
    assert.equal(drill.is_bookmarked, false);
  });

  it('rejects non-admin/tutor roles', async () => {
    await assert.rejects(
      () =>
        service.setDrillBookmarked(DRILL_ID, true, {
          userId: 'user-1',
          userRole: 'user',
        }),
      (err: unknown) => err instanceof ForbiddenError
    );
    assert.equal(findById.mock.callCount(), 0);
    assert.equal(update.mock.callCount(), 0);
  });

  it('throws NotFoundError when drill is missing', async () => {
    findById.mock.mockImplementation(async () => null);
    await assert.rejects(
      () =>
        service.setDrillBookmarked(DRILL_ID, true, {
          userId: 'admin-1',
          userRole: 'admin',
        }),
      (err: unknown) => err instanceof NotFoundError
    );
    assert.equal(update.mock.callCount(), 0);
  });
});
