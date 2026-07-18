import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import config from './config';
import { resolveStripePriceId } from './stripe-checkout-session';

const PRICE_ID = 'price_checkout_monthly';
const original = config.STRIPE_PREMIUM_MONTHLY_PRICE_ID;

function setMonthlyPriceId(value: string | undefined) {
  (config as { STRIPE_PREMIUM_MONTHLY_PRICE_ID?: string }).STRIPE_PREMIUM_MONTHLY_PRICE_ID =
    value;
}

describe('resolveStripePriceId', () => {
  beforeEach(() => {
    setMonthlyPriceId(PRICE_ID);
  });

  afterEach(() => {
    setMonthlyPriceId(original);
  });

  it('returns the configured monthly price ID', () => {
    assert.equal(resolveStripePriceId(), PRICE_ID);
  });

  it('returns undefined when monthly price is not configured', () => {
    setMonthlyPriceId(undefined);
    assert.equal(resolveStripePriceId(), undefined);
  });
});
