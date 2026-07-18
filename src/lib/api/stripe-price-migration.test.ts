import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  schedulePriceChangeAtRenewal,
  schedulePriceMigrationAtRenewal,
} from './stripe-price-migration';

const LEGACY = 'price_legacy_monthly';
const NEW = 'price_new_monthly';
const QUARTERLY = 'price_new_quarterly';
const SUB_ID = 'sub_migrate_1';
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_702_592_000;

type CallLog = {
  subscriptionsRetrieve: unknown[];
  subscriptionsUpdate: unknown[];
  schedulesCreate: unknown[];
  schedulesUpdate: unknown[];
  schedulesRelease: unknown[];
};

function createStripeStub(options: {
  priceId?: string;
  schedule?: string | null;
  status?: string;
  trial_end?: number | null;
  callLog: CallLog;
}) {
  const priceId = options.priceId ?? LEGACY;
  let schedule = options.schedule ?? null;
  const status = options.status ?? 'active';
  const trial_end = options.trial_end ?? null;
  const { callLog } = options;

  return {
    subscriptions: {
      retrieve: async (id: string, params?: { expand?: string[] }) => {
        callLog.subscriptionsRetrieve.push({ id, params });
        return {
          id,
          schedule,
          status,
          trial_end,
          items: {
            data: [
              {
                price: { id: priceId },
                current_period_start: PERIOD_START,
                current_period_end: PERIOD_END,
              },
            ],
          },
        };
      },
      update: async (...args: unknown[]) => {
        callLog.subscriptionsUpdate.push(args);
        throw new Error('subscriptions.update must not be called');
      },
    },
    subscriptionSchedules: {
      create: async (
        params: { from_subscription: string },
        opts?: { idempotencyKey?: string }
      ) => {
        callLog.schedulesCreate.push({ params, opts });
        return { id: 'sub_sched_1' };
      },
      update: async (id: string, params: unknown) => {
        callLog.schedulesUpdate.push({ id, params });
        return { id };
      },
      release: async (id: string) => {
        callLog.schedulesRelease.push({ id });
        schedule = null;
        return { id };
      },
    },
  };
}

function emptyCallLog(): CallLog {
  return {
    subscriptionsRetrieve: [],
    subscriptionsUpdate: [],
    schedulesCreate: [],
    schedulesUpdate: [],
    schedulesRelease: [],
  };
}

describe('schedulePriceChangeAtRenewal', () => {
  it('uses current item price as phase 1 for any current→target pair', async () => {
    const callLog = emptyCallLog();
    const stripe = createStripeStub({ priceId: QUARTERLY, callLog });

    const result = await schedulePriceChangeAtRenewal(
      stripe as never,
      SUB_ID,
      NEW,
      { idempotencyKey: `cohort-sync-${SUB_ID}-${NEW}-test` }
    );

    assert.deepEqual(result, {
      status: 'scheduled',
      scheduleId: 'sub_sched_1',
    });
    assert.deepEqual(callLog.schedulesUpdate[0], {
      id: 'sub_sched_1',
      params: {
        proration_behavior: 'none',
        phases: [
          {
            items: [{ price: QUARTERLY, quantity: 1 }],
            start_date: PERIOD_START,
            end_date: PERIOD_END,
            proration_behavior: 'none',
          },
          {
            items: [{ price: NEW, quantity: 1 }],
            proration_behavior: 'none',
          },
        ],
        end_behavior: 'release',
      },
    });
    assert.equal(callLog.subscriptionsUpdate.length, 0);
  });

  it('releases opposing schedule before creating a new one', async () => {
    const callLog = emptyCallLog();
    const stripe = createStripeStub({
      priceId: LEGACY,
      schedule: 'sub_sched_old',
      callLog,
    });

    const result = await schedulePriceChangeAtRenewal(
      stripe as never,
      SUB_ID,
      NEW
    );

    assert.equal(result.status, 'scheduled');
    assert.deepEqual(callLog.schedulesRelease, [{ id: 'sub_sched_old' }]);
    assert.equal(callLog.schedulesCreate.length, 1);
  });

  it('preserves trial_end on phase 1 when subscription is trialing', async () => {
    const callLog = emptyCallLog();
    const stripe = createStripeStub({
      priceId: NEW,
      status: 'trialing',
      trial_end: PERIOD_END,
      callLog,
    });

    const result = await schedulePriceChangeAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY
    );

    assert.deepEqual(result, {
      status: 'scheduled',
      scheduleId: 'sub_sched_1',
    });
    assert.deepEqual(callLog.schedulesUpdate[0], {
      id: 'sub_sched_1',
      params: {
        proration_behavior: 'none',
        phases: [
          {
            items: [{ price: NEW, quantity: 1 }],
            start_date: PERIOD_START,
            end_date: PERIOD_END,
            proration_behavior: 'none',
            trial_end: PERIOD_END,
          },
          {
            items: [{ price: LEGACY, quantity: 1 }],
            proration_behavior: 'none',
          },
        ],
        end_behavior: 'release',
      },
    });
    assert.equal(callLog.subscriptionsUpdate.length, 0);
  });
});

describe('schedulePriceMigrationAtRenewal', () => {
  it('schedules create+update with proration_behavior none and migration idempotency key', async () => {
    const callLog = emptyCallLog();
    const stripe = createStripeStub({ callLog });

    const result = await schedulePriceMigrationAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY,
      NEW
    );

    assert.deepEqual(result, {
      status: 'scheduled',
      scheduleId: 'sub_sched_1',
    });
    assert.equal(callLog.schedulesCreate.length, 1);
    assert.deepEqual(callLog.schedulesCreate[0], {
      params: { from_subscription: SUB_ID },
      opts: { idempotencyKey: `migration-2026-${SUB_ID}` },
    });
    assert.equal(callLog.schedulesUpdate.length, 1);
    assert.deepEqual(callLog.schedulesUpdate[0], {
      id: 'sub_sched_1',
      params: {
        proration_behavior: 'none',
        phases: [
          {
            items: [{ price: LEGACY, quantity: 1 }],
            start_date: PERIOD_START,
            end_date: PERIOD_END,
            proration_behavior: 'none',
          },
          {
            items: [{ price: NEW, quantity: 1 }],
            proration_behavior: 'none',
          },
        ],
        end_behavior: 'release',
      },
    });
    assert.equal(callLog.subscriptionsUpdate.length, 0);
  });

  it('preserves trial_end on phase 1 when subscription is trialing', async () => {
    const callLog = emptyCallLog();
    const stripe = createStripeStub({
      status: 'trialing',
      trial_end: PERIOD_END,
      callLog,
    });

    const result = await schedulePriceMigrationAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY,
      NEW
    );

    assert.deepEqual(result, {
      status: 'scheduled',
      scheduleId: 'sub_sched_1',
    });
    assert.deepEqual(callLog.schedulesUpdate[0], {
      id: 'sub_sched_1',
      params: {
        proration_behavior: 'none',
        phases: [
          {
            items: [{ price: LEGACY, quantity: 1 }],
            start_date: PERIOD_START,
            end_date: PERIOD_END,
            proration_behavior: 'none',
            trial_end: PERIOD_END,
          },
          {
            items: [{ price: NEW, quantity: 1 }],
            proration_behavior: 'none',
          },
        ],
        end_behavior: 'release',
      },
    });
    assert.equal(callLog.subscriptionsUpdate.length, 0);
  });

  it('skips already_new_price without creating a schedule', async () => {
    const callLog = emptyCallLog();
    const stripe = createStripeStub({ priceId: NEW, callLog });

    const result = await schedulePriceMigrationAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY,
      NEW
    );

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'already_new_price',
    });
    assert.equal(callLog.schedulesCreate.length, 0);
    assert.equal(callLog.schedulesUpdate.length, 0);
    assert.equal(callLog.subscriptionsUpdate.length, 0);
  });

  it('skips already_has_schedule without creating a schedule', async () => {
    const callLog = emptyCallLog();
    const stripe = createStripeStub({
      schedule: 'sub_sched_existing',
      callLog,
    });

    const result = await schedulePriceMigrationAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY,
      NEW
    );

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'already_has_schedule',
    });
    assert.equal(callLog.schedulesCreate.length, 0);
    assert.equal(callLog.schedulesUpdate.length, 0);
    assert.equal(callLog.subscriptionsUpdate.length, 0);
  });
});
