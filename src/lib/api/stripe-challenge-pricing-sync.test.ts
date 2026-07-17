import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import config from './config';
import {
  syncStripeForZeroPauseMaintainerPricing,
  syncStripeForZeroPauseChallengePricing,
} from './stripe-challenge-pricing-sync';
import { schedulePriceChangeAtRenewal } from './stripe-price-migration';

const LEGACY = 'price_legacy_monthly';
const NEW = 'price_new_monthly';
const QUARTERLY = 'price_new_quarterly';
const ANNUAL = 'price_new_annual';
const SUB_ID = 'sub_challenge_1';
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_702_592_000;
const CHALLENGE_END = '2026-08-31';

type CallLog = {
  subscriptionsRetrieve: unknown[];
  subscriptionsUpdate: unknown[];
  schedulesCreate: unknown[];
  schedulesUpdate: unknown[];
  schedulesRelease: unknown[];
  subscriptionsList: unknown[];
};

function createCallLog(): CallLog {
  return {
    subscriptionsRetrieve: [],
    subscriptionsUpdate: [],
    schedulesCreate: [],
    schedulesUpdate: [],
    schedulesRelease: [],
    subscriptionsList: [],
  };
}

function createStripeStub(options: {
  priceId?: string;
  schedule?: string | null;
  callLog: CallLog;
  /** After release, subsequent retrieves have no schedule. */
  clearScheduleOnRelease?: boolean;
  /** Mutable price id for multi-step round-trip tests. */
  mutable?: { priceId: string; schedule: string | null };
}) {
  const mutable = options.mutable ?? {
    priceId: options.priceId ?? LEGACY,
    schedule: options.schedule ?? null,
  };
  const { callLog } = options;
  const clearOnRelease = options.clearScheduleOnRelease ?? true;
  let scheduleCreateCount = 0;

  return {
    mutable,
    subscriptions: {
      retrieve: async (id: string, params?: { expand?: string[] }) => {
        callLog.subscriptionsRetrieve.push({ id, params });
        return {
          id,
          schedule: mutable.schedule,
          items: {
            data: [
              {
                price: { id: mutable.priceId },
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
      list: async (params: unknown) => {
        callLog.subscriptionsList.push(params);
        return { data: [] };
      },
    },
    subscriptionSchedules: {
      create: async (
        params: { from_subscription: string },
        opts?: { idempotencyKey?: string }
      ) => {
        callLog.schedulesCreate.push({ params, opts });
        scheduleCreateCount += 1;
        const id = `sub_sched_challenge_${scheduleCreateCount}`;
        mutable.schedule = id;
        return { id };
      },
      update: async (id: string, params: unknown) => {
        callLog.schedulesUpdate.push({ id, params });
        return { id };
      },
      release: async (id: string) => {
        callLog.schedulesRelease.push({ id });
        if (clearOnRelease) mutable.schedule = null;
        return { id };
      },
    },
  };
}

function withPriceConfig(run: () => Promise<void> | void) {
  const previous = {
    legacy: config.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY,
    monthly: config.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    quarterly: config.STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
    annual: config.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
  };

  (
    config as { STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY?: string }
  ).STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY = LEGACY;
  (config as { STRIPE_PREMIUM_MONTHLY_PRICE_ID?: string }).STRIPE_PREMIUM_MONTHLY_PRICE_ID =
    NEW;
  (
    config as { STRIPE_PREMIUM_QUARTERLY_PRICE_ID?: string }
  ).STRIPE_PREMIUM_QUARTERLY_PRICE_ID = QUARTERLY;
  (config as { STRIPE_PREMIUM_ANNUAL_PRICE_ID?: string }).STRIPE_PREMIUM_ANNUAL_PRICE_ID =
    ANNUAL;

  return Promise.resolve(run()).finally(() => {
    (
      config as { STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY?: string }
    ).STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY = previous.legacy;
    (
      config as { STRIPE_PREMIUM_MONTHLY_PRICE_ID?: string }
    ).STRIPE_PREMIUM_MONTHLY_PRICE_ID = previous.monthly;
    (
      config as { STRIPE_PREMIUM_QUARTERLY_PRICE_ID?: string }
    ).STRIPE_PREMIUM_QUARTERLY_PRICE_ID = previous.quarterly;
    (
      config as { STRIPE_PREMIUM_ANNUAL_PRICE_ID?: string }
    ).STRIPE_PREMIUM_ANNUAL_PRICE_ID = previous.annual;
  });
}

describe('schedulePriceChangeAtRenewal', () => {
  it('schedules current→target with proration_behavior none', async () => {
    const callLog = createCallLog();
    const stripe = createStripeStub({ priceId: QUARTERLY, callLog });

    const result = await schedulePriceChangeAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY,
      { idempotencyKey: `cohort-sync-${SUB_ID}-${LEGACY}-test` }
    );

    assert.deepEqual(result, {
      status: 'scheduled',
      scheduleId: 'sub_sched_challenge_1',
    });
    assert.deepEqual(callLog.schedulesCreate[0], {
      params: { from_subscription: SUB_ID },
      opts: { idempotencyKey: `cohort-sync-${SUB_ID}-${LEGACY}-test` },
    });
    assert.deepEqual(callLog.schedulesUpdate[0], {
      id: 'sub_sched_challenge_1',
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
            items: [{ price: LEGACY, quantity: 1 }],
            proration_behavior: 'none',
          },
        ],
        end_behavior: 'release',
      },
    });
    assert.equal(callLog.subscriptionsUpdate.length, 0);
  });

  it('skips when already on target price', async () => {
    const callLog = createCallLog();
    const stripe = createStripeStub({ priceId: LEGACY, callLog });

    const result = await schedulePriceChangeAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY
    );

    assert.deepEqual(result, {
      status: 'skipped',
      reason: 'already_on_target_price',
    });
    assert.equal(callLog.schedulesCreate.length, 0);
  });

  it('releases existing schedule then creates target schedule', async () => {
    const callLog = createCallLog();
    const stripe = createStripeStub({
      priceId: NEW,
      schedule: 'sub_sched_phase7',
      callLog,
    });

    const result = await schedulePriceChangeAtRenewal(
      stripe as never,
      SUB_ID,
      LEGACY
    );

    assert.equal(result.status, 'scheduled');
    assert.deepEqual(callLog.schedulesRelease, [{ id: 'sub_sched_phase7' }]);
    assert.equal(callLog.schedulesCreate.length, 1);
  });
});

describe('syncStripeForZeroPauseChallengePricing decision matrix', () => {
  it('Legacy + Phase 7 schedule → release only; no new schedule', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({
        priceId: LEGACY,
        schedule: 'sub_sched_phase7',
        callLog,
      });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: 'sub_sched_phase7',
        zeroPauseEndDate: CHALLENGE_END,
      };

      const result = await syncStripeForZeroPauseChallengePricing(
        stripe as never,
        user,
        { enteringFromNonChallenge: true }
      );

      assert.deepEqual(result, {
        status: 'released_schedule_only',
        releasedScheduleId: 'sub_sched_phase7',
      });
      assert.equal(user.stripeScheduleId, undefined);
      assert.deepEqual(callLog.schedulesRelease, [{ id: 'sub_sched_phase7' }]);
      assert.equal(callLog.schedulesCreate.length, 0);
      assert.equal(callLog.subscriptionsUpdate.length, 0);
    });
  });

  it('New $20 + no schedule → schedule → legacy at period end', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: NEW, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: null as string | null,
        zeroPauseEndDate: CHALLENGE_END,
        zeroPausePriorStripePriceId: null as string | null,
        zeroPausePriorBillingPeriod: null as 'monthly' | null,
      };

      const result = await syncStripeForZeroPauseChallengePricing(
        stripe as never,
        user,
        {
          enteringFromNonChallenge: true,
          idempotencyKey: `cohort-sync-${SUB_ID}-${LEGACY}-fixed`,
        }
      );

      assert.deepEqual(result, {
        status: 'scheduled_legacy',
        scheduleId: 'sub_sched_challenge_1',
      });
      assert.equal(user.stripeScheduleId, 'sub_sched_challenge_1');
      assert.equal(user.zeroPausePriorStripePriceId, NEW);
      assert.equal(user.zeroPausePriorBillingPeriod, 'monthly');
      assert.deepEqual(
        (callLog.schedulesCreate[0] as { opts?: { idempotencyKey?: string } })
          .opts,
        { idempotencyKey: `cohort-sync-${SUB_ID}-${LEGACY}-fixed` }
      );
      assert.equal(callLog.subscriptionsUpdate.length, 0);
    });
  });

  it('Quarterly → schedule → legacy and stores prior quarterly price', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: QUARTERLY, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: null as string | null,
        subscriptionBillingPeriod: 'quarterly' as const,
        zeroPauseEndDate: CHALLENGE_END,
        zeroPausePriorStripePriceId: null as string | null,
        zeroPausePriorBillingPeriod: null as 'quarterly' | null,
      };

      const result = await syncStripeForZeroPauseChallengePricing(
        stripe as never,
        user,
        { enteringFromNonChallenge: true }
      );

      assert.equal(result.status, 'scheduled_legacy');
      assert.equal(user.zeroPausePriorStripePriceId, QUARTERLY);
      assert.equal(user.zeroPausePriorBillingPeriod, 'quarterly');
      assert.deepEqual(callLog.schedulesUpdate[0], {
        id: 'sub_sched_challenge_1',
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
              items: [{ price: LEGACY, quantity: 1 }],
              proration_behavior: 'none',
            },
          ],
          end_behavior: 'release',
        },
      });
    });
  });

  it('New $20 + Phase 7 leftover → release then schedule → legacy', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({
        priceId: NEW,
        schedule: 'sub_sched_phase7',
        callLog,
      });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: 'sub_sched_phase7',
        zeroPauseEndDate: CHALLENGE_END,
      };

      const result = await syncStripeForZeroPauseChallengePricing(
        stripe as never,
        user,
        { enteringFromNonChallenge: true }
      );

      assert.deepEqual(result, {
        status: 'scheduled_legacy',
        scheduleId: 'sub_sched_challenge_1',
        releasedScheduleId: 'sub_sched_phase7',
      });
      assert.equal(user.stripeScheduleId, 'sub_sched_challenge_1');
      assert.deepEqual(callLog.schedulesRelease, [{ id: 'sub_sched_phase7' }]);
      assert.equal(callLog.schedulesCreate.length, 1);
    });
  });

  it('Legacy + no schedule → no-op', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: LEGACY, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: null as string | null,
        zeroPauseEndDate: CHALLENGE_END,
      };

      const result = await syncStripeForZeroPauseChallengePricing(stripe as never, user);

      assert.deepEqual(result, { status: 'noop_already_legacy' });
      assert.equal(callLog.schedulesRelease.length, 0);
      assert.equal(callLog.schedulesCreate.length, 0);
    });
  });

  it('skips when user has no Stripe subscription', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ callLog });
      const user = {
        stripeSubscriptionId: null as string | null,
        stripeCustomerId: null as string | null,
        zeroPauseEndDate: CHALLENGE_END,
      };

      const result = await syncStripeForZeroPauseChallengePricing(stripe as never, user);

      assert.deepEqual(result, { status: 'skipped_no_subscription' });
      assert.equal(callLog.subscriptionsRetrieve.length, 0);
    });
  });

  it('does not overwrite prior when re-saving Challenge', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: NEW, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        zeroPausePriorStripePriceId: QUARTERLY,
        zeroPausePriorBillingPeriod: 'quarterly' as const,
      };

      await syncStripeForZeroPauseChallengePricing(stripe as never, user, {
        enteringFromNonChallenge: false,
      });

      assert.equal(user.zeroPausePriorStripePriceId, QUARTERLY);
      assert.equal(user.zeroPausePriorBillingPeriod, 'quarterly');
    });
  });
});

describe('syncStripeForZeroPauseMaintainerPricing decision matrix', () => {
  it('Legacy + Challenge→legacy schedule → release + restore prior monthly', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({
        priceId: LEGACY,
        schedule: 'sub_sched_challenge_legacy',
        callLog,
      });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: 'sub_sched_challenge_legacy',
        zeroPausePriorStripePriceId: NEW,
        zeroPausePriorBillingPeriod: 'monthly' as const,
      };

      const result = await syncStripeForZeroPauseMaintainerPricing(
        stripe as never,
        user,
        { idempotencyKey: `cohort-sync-${SUB_ID}-${NEW}-fixed` }
      );

      assert.deepEqual(result, {
        status: 'scheduled_restore',
        scheduleId: 'sub_sched_challenge_1',
        targetPriceId: NEW,
        releasedScheduleId: 'sub_sched_challenge_legacy',
      });
      assert.equal(user.stripeScheduleId, 'sub_sched_challenge_1');
      assert.equal(user.subscriptionBillingPeriod, 'monthly');
      assert.equal(user.zeroPausePriorStripePriceId, null);
      assert.equal(user.zeroPausePriorBillingPeriod, null);
      assert.deepEqual(
        (callLog.schedulesCreate[0] as { opts?: { idempotencyKey?: string } })
          .opts,
        { idempotencyKey: `cohort-sync-${SUB_ID}-${NEW}-fixed` }
      );
      assert.deepEqual(callLog.schedulesUpdate[0], {
        id: 'sub_sched_challenge_1',
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
    });
  });

  it('Legacy + prior quarterly → schedule restore to quarterly', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: LEGACY, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        zeroPausePriorStripePriceId: QUARTERLY,
        zeroPausePriorBillingPeriod: 'quarterly' as const,
      };

      const result = await syncStripeForZeroPauseMaintainerPricing(stripe as never, user);

      assert.deepEqual(result, {
        status: 'scheduled_restore',
        scheduleId: 'sub_sched_challenge_1',
        targetPriceId: QUARTERLY,
      });
      assert.equal(user.subscriptionBillingPeriod, 'quarterly');
      assert.equal(user.zeroPausePriorStripePriceId, null);
      assert.deepEqual(callLog.schedulesUpdate[0], {
        id: 'sub_sched_challenge_1',
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
              items: [{ price: QUARTERLY, quantity: 1 }],
              proration_behavior: 'none',
            },
          ],
          end_behavior: 'release',
        },
      });
    });
  });

  it('Already on target + Challenge schedule → release only', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({
        priceId: NEW,
        schedule: 'sub_sched_challenge_legacy',
        callLog,
      });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: 'sub_sched_challenge_legacy',
        zeroPausePriorStripePriceId: NEW,
        zeroPausePriorBillingPeriod: 'monthly' as const,
      };

      const result = await syncStripeForZeroPauseMaintainerPricing(stripe as never, user);

      assert.deepEqual(result, {
        status: 'released_schedule_only',
        releasedScheduleId: 'sub_sched_challenge_legacy',
        targetPriceId: NEW,
      });
      assert.equal(user.stripeScheduleId, undefined);
      assert.equal(user.zeroPausePriorStripePriceId, null);
      assert.equal(callLog.schedulesCreate.length, 0);
    });
  });

  it('Already on new monthly with no prior → no-op restore target', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: NEW, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        stripeScheduleId: null as string | null,
      };

      const result = await syncStripeForZeroPauseMaintainerPricing(stripe as never, user);

      assert.deepEqual(result, {
        status: 'noop_already_target',
        targetPriceId: NEW,
      });
      assert.equal(callLog.schedulesCreate.length, 0);
    });
  });
});

describe('Challenge ↔ Maintainer round-trips', () => {
  it('quarterly Challenge → Maintainer restores quarterly and clears prior', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: QUARTERLY, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        subscriptionBillingPeriod: 'quarterly' as const,
        zeroPausePriorStripePriceId: null as string | null,
        zeroPausePriorBillingPeriod: null as 'quarterly' | null,
      };

      const challenge = await syncStripeForZeroPauseChallengePricing(
        stripe as never,
        user,
        { enteringFromNonChallenge: true }
      );
      assert.equal(challenge.status, 'scheduled_legacy');
      assert.equal(user.zeroPausePriorStripePriceId, QUARTERLY);

      // Simulate still on quarterly mid-cycle with Challenge→legacy schedule.
      const maintainer = await syncStripeForZeroPauseMaintainerPricing(
        stripe as never,
        user
      );
      // Current price still quarterly (= prior target) after releasing Challenge schedule.
      assert.equal(maintainer.status, 'released_schedule_only');
      assert.equal(
        'targetPriceId' in maintainer ? maintainer.targetPriceId : null,
        QUARTERLY
      );
      assert.equal(user.zeroPausePriorStripePriceId, null);
      assert.equal(user.subscriptionBillingPeriod, 'quarterly');
    });
  });

  it('monthly Challenge → Maintainer → Challenge again creates a new schedule', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: NEW, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        subscriptionBillingPeriod: 'monthly' as const,
        zeroPausePriorStripePriceId: null as string | null,
        zeroPausePriorBillingPeriod: null as 'monthly' | null,
      };

      const firstChallenge = await syncStripeForZeroPauseChallengePricing(
        stripe as never,
        user,
        {
          enteringFromNonChallenge: true,
          idempotencyKey: `cohort-sync-${SUB_ID}-c1`,
        }
      );
      assert.equal(firstChallenge.status, 'scheduled_legacy');
      assert.equal(user.zeroPausePriorStripePriceId, NEW);
      assert.equal(callLog.schedulesCreate.length, 1);

      // Mid-cycle leave: still on NEW; release Challenge schedule → already on NEW target.
      const maintainer = await syncStripeForZeroPauseMaintainerPricing(
        stripe as never,
        user,
        { idempotencyKey: `cohort-sync-${SUB_ID}-m1` }
      );
      assert.equal(maintainer.status, 'released_schedule_only');
      assert.equal(user.zeroPausePriorStripePriceId, null);

      // Re-enter Challenge: must create a *new* schedule (unique key), not no-op.
      const secondChallenge = await syncStripeForZeroPauseChallengePricing(
        stripe as never,
        user,
        {
          enteringFromNonChallenge: true,
          idempotencyKey: `cohort-sync-${SUB_ID}-c2`,
        }
      );
      assert.equal(secondChallenge.status, 'scheduled_legacy');
      assert.equal(callLog.schedulesCreate.length, 2);
      assert.deepEqual(
        (callLog.schedulesCreate[0] as { opts?: { idempotencyKey?: string } })
          .opts?.idempotencyKey,
        `cohort-sync-${SUB_ID}-c1`
      );
      assert.deepEqual(
        (callLog.schedulesCreate[1] as { opts?: { idempotencyKey?: string } })
          .opts?.idempotencyKey,
        `cohort-sync-${SUB_ID}-c2`
      );
      assert.notEqual(
        (callLog.schedulesCreate[0] as { opts?: { idempotencyKey?: string } })
          .opts?.idempotencyKey,
        (callLog.schedulesCreate[1] as { opts?: { idempotencyKey?: string } })
          .opts?.idempotencyKey
      );
    });
  });

  it('legacy-billed Challenge then Maintainer restores prior after renewal simulation', async () => {
    await withPriceConfig(async () => {
      const callLog = createCallLog();
      const stripe = createStripeStub({ priceId: QUARTERLY, callLog });
      const user = {
        stripeSubscriptionId: SUB_ID,
        subscriptionBillingPeriod: 'quarterly' as const,
        zeroPausePriorStripePriceId: null as string | null,
        zeroPausePriorBillingPeriod: null as 'quarterly' | null,
      };

      await syncStripeForZeroPauseChallengePricing(stripe as never, user, {
        enteringFromNonChallenge: true,
      });
      assert.equal(user.zeroPausePriorStripePriceId, QUARTERLY);

      // Simulate renewal applied: now on legacy, Challenge schedule released.
      stripe.mutable.priceId = LEGACY;
      stripe.mutable.schedule = null;

      const maintainer = await syncStripeForZeroPauseMaintainerPricing(
        stripe as never,
        user,
        { idempotencyKey: `cohort-sync-${SUB_ID}-restore-q` }
      );

      assert.deepEqual(maintainer, {
        status: 'scheduled_restore',
        scheduleId: 'sub_sched_challenge_2',
        targetPriceId: QUARTERLY,
      });
      assert.equal(user.zeroPausePriorStripePriceId, null);
      assert.equal(user.subscriptionBillingPeriod, 'quarterly');
      assert.equal(callLog.subscriptionsUpdate.length, 0);
    });
  });
});
