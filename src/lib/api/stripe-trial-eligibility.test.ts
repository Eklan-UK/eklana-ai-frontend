import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import config from './config';
import {
  getSubscriptionTrialLaunchDate,
  isEligibleForTrial,
  hasPriorStripeSubscriptions,
} from './stripe-trial-eligibility';

const LAUNCH_ISO = '2026-08-01T00:00:00.000Z';
const LAUNCH = new Date(LAUNCH_ISO);
const postLaunch = new Date('2026-08-15T12:00:00.000Z');
const preLaunch = new Date('2026-07-01T12:00:00.000Z');

const originalLaunchAt = config.SUBSCRIPTION_TRIAL_LAUNCH_AT;

function setLaunchAt(value: string | undefined) {
  (config as { SUBSCRIPTION_TRIAL_LAUNCH_AT?: string }).SUBSCRIPTION_TRIAL_LAUNCH_AT =
    value;
}

function neverSubscribedUser(createdAt: Date) {
  return {
    createdAt,
    subscriptionActivatedAt: null,
    subscriptionProvider: null,
    stripeSubscriptionId: undefined,
    appleOriginalTransactionId: undefined,
  };
}

describe('getSubscriptionTrialLaunchDate', () => {
  afterEach(() => {
    setLaunchAt(originalLaunchAt);
  });

  it('returns Date when SUBSCRIPTION_TRIAL_LAUNCH_AT is valid', () => {
    setLaunchAt(LAUNCH_ISO);
    const d = getSubscriptionTrialLaunchDate();
    assert.ok(d instanceof Date);
    assert.equal(d!.getTime(), LAUNCH.getTime());
  });

  it('returns null when SUBSCRIPTION_TRIAL_LAUNCH_AT is missing', () => {
    setLaunchAt(undefined);
    assert.equal(getSubscriptionTrialLaunchDate(), null);
  });

  it('returns null when SUBSCRIPTION_TRIAL_LAUNCH_AT is invalid', () => {
    setLaunchAt('not-a-date');
    assert.equal(getSubscriptionTrialLaunchDate(), null);
  });
});

describe('isEligibleForTrial', () => {
  beforeEach(() => {
    setLaunchAt(LAUNCH_ISO);
  });

  afterEach(() => {
    setLaunchAt(originalLaunchAt);
  });

  it('returns true for post-launch account that never subscribed', () => {
    assert.equal(isEligibleForTrial(neverSubscribedUser(postLaunch)), true);
  });

  it('returns false for pre-launch account', () => {
    assert.equal(isEligibleForTrial(neverSubscribedUser(preLaunch)), false);
  });

  it('returns false when subscriptionActivatedAt is set', () => {
    assert.equal(
      isEligibleForTrial({
        ...neverSubscribedUser(postLaunch),
        subscriptionActivatedAt: new Date('2026-08-20T00:00:00.000Z'),
      }),
      false
    );
  });

  it('returns false when stripeSubscriptionId is set', () => {
    assert.equal(
      isEligibleForTrial({
        ...neverSubscribedUser(postLaunch),
        stripeSubscriptionId: 'sub_123',
      }),
      false
    );
  });

  it('returns false when appleOriginalTransactionId is set', () => {
    assert.equal(
      isEligibleForTrial({
        ...neverSubscribedUser(postLaunch),
        appleOriginalTransactionId: '1000000123456789',
      }),
      false
    );
  });

  it('returns false when subscriptionProvider is set', () => {
    assert.equal(
      isEligibleForTrial({
        ...neverSubscribedUser(postLaunch),
        subscriptionProvider: 'stripe',
      }),
      false
    );
  });

  it('returns false when SUBSCRIPTION_TRIAL_LAUNCH_AT is missing', () => {
    setLaunchAt(undefined);
    assert.equal(isEligibleForTrial(neverSubscribedUser(postLaunch)), false);
  });
});

describe('hasPriorStripeSubscriptions', () => {
  it('returns true when Stripe returns at least one subscription', async () => {
    const stripe = {
      subscriptions: {
        list: async () => ({ data: [{ id: 'sub_1' }] }),
      },
    };
    assert.equal(
      await hasPriorStripeSubscriptions(stripe as never, 'cus_123'),
      true
    );
  });

  it('returns false when Stripe returns no subscriptions', async () => {
    const stripe = {
      subscriptions: {
        list: async (params: {
          customer: string;
          status: string;
          limit: number;
        }) => {
          assert.equal(params.customer, 'cus_empty');
          assert.equal(params.status, 'all');
          assert.equal(params.limit, 1);
          return { data: [] };
        },
      },
    };
    assert.equal(
      await hasPriorStripeSubscriptions(stripe as never, 'cus_empty'),
      false
    );
  });
});
