import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  billingPeriodFromStripePriceId,
  applyBillingPeriodFromPriceId,
} from './stripe-billing-period';

const ENV_KEYS = [
  'STRIPE_PREMIUM_MONTHLY_PRICE_ID',
  'STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY',
  'STRIPE_PREMIUM_QUARTERLY_PRICE_ID',
  'STRIPE_PREMIUM_ANNUAL_PRICE_ID',
] as const;

const PRICE_IDS = {
  monthly: 'price_monthly_new_test',
  legacy: 'price_monthly_legacy_test',
  quarterly: 'price_quarterly_test',
  annual: 'price_annual_test',
} as const;

const originalEnv: Record<(typeof ENV_KEYS)[number], string | undefined> = {
  STRIPE_PREMIUM_MONTHLY_PRICE_ID: undefined,
  STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY: undefined,
  STRIPE_PREMIUM_QUARTERLY_PRICE_ID: undefined,
  STRIPE_PREMIUM_ANNUAL_PRICE_ID: undefined,
};

describe('billingPeriodFromStripePriceId', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID = PRICE_IDS.monthly;
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY = PRICE_IDS.legacy;
    process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID = PRICE_IDS.quarterly;
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID = PRICE_IDS.annual;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('maps legacy monthly price ID to monthly', () => {
    assert.equal(billingPeriodFromStripePriceId(PRICE_IDS.legacy), 'monthly');
  });

  it('maps new monthly price ID to monthly', () => {
    assert.equal(billingPeriodFromStripePriceId(PRICE_IDS.monthly), 'monthly');
  });

  it('maps quarterly price ID to quarterly', () => {
    assert.equal(
      billingPeriodFromStripePriceId(PRICE_IDS.quarterly),
      'quarterly'
    );
  });

  it('maps annual price ID to annual', () => {
    assert.equal(billingPeriodFromStripePriceId(PRICE_IDS.annual), 'annual');
  });

  it('uses keyword fallback for unknown IDs containing period words', () => {
    assert.equal(
      billingPeriodFromStripePriceId('price_custom_monthly_xyz'),
      'monthly'
    );
    assert.equal(
      billingPeriodFromStripePriceId('price_custom_quarterly_xyz'),
      'quarterly'
    );
    assert.equal(
      billingPeriodFromStripePriceId('price_custom_annual_xyz'),
      'annual'
    );
    assert.equal(
      billingPeriodFromStripePriceId('price_custom_yearly_xyz'),
      'annual'
    );
  });

  it('returns undefined for unknown / empty price IDs', () => {
    assert.equal(billingPeriodFromStripePriceId(undefined), undefined);
    assert.equal(billingPeriodFromStripePriceId(null), undefined);
    assert.equal(billingPeriodFromStripePriceId(''), undefined);
    assert.equal(billingPeriodFromStripePriceId('price_unknown_xyz'), undefined);
  });
});

describe('applyBillingPeriodFromPriceId', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID = PRICE_IDS.monthly;
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY = PRICE_IDS.legacy;
    process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID = PRICE_IDS.quarterly;
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID = PRICE_IDS.annual;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('sets subscriptionBillingPeriod for monthly / quarterly / annual', () => {
    const monthlyUser: { subscriptionBillingPeriod?: string | null } = {};
    applyBillingPeriodFromPriceId(monthlyUser, PRICE_IDS.monthly);
    assert.equal(monthlyUser.subscriptionBillingPeriod, 'monthly');

    const quarterlyUser: { subscriptionBillingPeriod?: string | null } = {};
    applyBillingPeriodFromPriceId(quarterlyUser, PRICE_IDS.quarterly);
    assert.equal(quarterlyUser.subscriptionBillingPeriod, 'quarterly');

    const annualUser: { subscriptionBillingPeriod?: string | null } = {};
    applyBillingPeriodFromPriceId(annualUser, PRICE_IDS.annual);
    assert.equal(annualUser.subscriptionBillingPeriod, 'annual');
  });

  it('leaves subscriptionBillingPeriod unchanged when price is unmappable', () => {
    const user: { subscriptionBillingPeriod?: string | null } = {
      subscriptionBillingPeriod: 'monthly',
    };
    applyBillingPeriodFromPriceId(user, 'price_unknown_xyz');
    assert.equal(user.subscriptionBillingPeriod, 'monthly');
  });
});
