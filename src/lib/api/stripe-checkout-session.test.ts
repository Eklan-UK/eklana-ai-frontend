import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import config from './config';
import {
  resolveStripePriceId,
  subscriptionDataForCheckout,
} from './stripe-checkout-session';

const PRICE_IDS = {
  monthly: 'price_checkout_monthly',
  quarterly: 'price_checkout_quarterly',
  annual: 'price_checkout_annual',
} as const;

const original = {
  monthly: config.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  quarterly: config.STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
  annual: config.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
};

function setPriceIds(values: {
  monthly?: string;
  quarterly?: string;
  annual?: string;
}) {
  (config as { STRIPE_PREMIUM_MONTHLY_PRICE_ID?: string }).STRIPE_PREMIUM_MONTHLY_PRICE_ID =
    values.monthly;
  (config as { STRIPE_PREMIUM_QUARTERLY_PRICE_ID?: string }).STRIPE_PREMIUM_QUARTERLY_PRICE_ID =
    values.quarterly;
  (config as { STRIPE_PREMIUM_ANNUAL_PRICE_ID?: string }).STRIPE_PREMIUM_ANNUAL_PRICE_ID =
    values.annual;
}

describe('resolveStripePriceId', () => {
  beforeEach(() => {
    setPriceIds(PRICE_IDS);
  });

  afterEach(() => {
    setPriceIds(original);
  });

  it('returns configured monthly / quarterly / annual price IDs', () => {
    assert.equal(resolveStripePriceId('monthly'), PRICE_IDS.monthly);
    assert.equal(resolveStripePriceId('quarterly'), PRICE_IDS.quarterly);
    assert.equal(resolveStripePriceId('annual'), PRICE_IDS.annual);
  });

  it('returns undefined when the period price is not configured', () => {
    setPriceIds({ monthly: undefined, quarterly: undefined, annual: undefined });
    assert.equal(resolveStripePriceId('monthly'), undefined);
  });
});

describe('subscriptionDataForCheckout', () => {
  it('returns trial payload when eligible', () => {
    assert.deepEqual(subscriptionDataForCheckout(true, 'user_123'), {
      trial_period_days: 14,
      metadata: { userId: 'user_123' },
    });
  });

  it('returns undefined when not eligible', () => {
    assert.equal(subscriptionDataForCheckout(false, 'user_123'), undefined);
  });
});
