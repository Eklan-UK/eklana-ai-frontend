import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import config from './config';
import {
  applyZeroPauseChallengeExpiry,
  isZeroPauseChallengePricingActive,
  resolveCheckoutPriceForUser,
  toUtcDayStart,
} from './zero-pause-pricing';

const PRICE_IDS = {
  monthly: 'price_new_monthly',
  legacy: 'price_legacy_monthly',
  quarterly: 'price_quarterly',
  annual: 'price_annual',
} as const;

const original = {
  monthly: config.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  legacy: config.STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY,
  quarterly: config.STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
  annual: config.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
};

function setPriceIds(values: {
  monthly?: string;
  legacy?: string;
  quarterly?: string;
  annual?: string;
}) {
  (config as { STRIPE_PREMIUM_MONTHLY_PRICE_ID?: string }).STRIPE_PREMIUM_MONTHLY_PRICE_ID =
    values.monthly;
  (config as {
    STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY?: string;
  }).STRIPE_PREMIUM_MONTHLY_PRICE_ID_LEGACY = values.legacy;
  (config as { STRIPE_PREMIUM_QUARTERLY_PRICE_ID?: string }).STRIPE_PREMIUM_QUARTERLY_PRICE_ID =
    values.quarterly;
  (config as { STRIPE_PREMIUM_ANNUAL_PRICE_ID?: string }).STRIPE_PREMIUM_ANNUAL_PRICE_ID =
    values.annual;
}

describe('toUtcDayStart', () => {
  it('normalizes to UTC midnight', () => {
    const d = toUtcDayStart('2026-07-16T15:30:00.000Z');
    assert.equal(d.toISOString(), '2026-07-16T00:00:00.000Z');
  });
});

describe('isZeroPauseChallengePricingActive', () => {
  const window = {
    zeroPauseProducts: ['challenge'],
    zeroPauseDate: '2026-07-01T00:00:00.000Z',
    zeroPauseEndDate: '2026-07-31T00:00:00.000Z',
  };

  it('is true on start day and end day (inclusive)', () => {
    assert.equal(
      isZeroPauseChallengePricingActive(
        window,
        new Date('2026-07-01T12:00:00.000Z')
      ),
      true
    );
    assert.equal(
      isZeroPauseChallengePricingActive(
        window,
        new Date('2026-07-31T23:59:59.000Z')
      ),
      true
    );
  });

  it('is false the day after end', () => {
    assert.equal(
      isZeroPauseChallengePricingActive(
        window,
        new Date('2026-08-01T00:00:00.000Z')
      ),
      false
    );
  });

  it('is false without challenge product or missing dates', () => {
    assert.equal(
      isZeroPauseChallengePricingActive(
        {
          ...window,
          zeroPauseProducts: ['maintainer'],
        },
        new Date('2026-07-15T00:00:00.000Z')
      ),
      false
    );
    assert.equal(
      isZeroPauseChallengePricingActive(
        {
          zeroPauseProducts: ['challenge'],
          zeroPauseDate: '2026-07-01T00:00:00.000Z',
          zeroPauseEndDate: null,
        },
        new Date('2026-07-15T00:00:00.000Z')
      ),
      false
    );
  });
});

describe('resolveCheckoutPriceForUser', () => {
  beforeEach(() => {
    setPriceIds(PRICE_IDS);
  });

  afterEach(() => {
    setPriceIds(original);
  });

  it('Maintainer (no dates) → new monthly / quarterly / annual prices', () => {
    const user = { zeroPauseProducts: ['maintainer'] };
    const monthly = resolveCheckoutPriceForUser(user, 'monthly');
    assert.equal(monthly.status, 'ok');
    if (monthly.status === 'ok') {
      assert.equal(monthly.priceId, PRICE_IDS.monthly);
      assert.equal(monthly.challengePricing, false);
    }
    const quarterly = resolveCheckoutPriceForUser(user, 'quarterly');
    assert.equal(quarterly.status, 'ok');
    if (quarterly.status === 'ok') {
      assert.equal(quarterly.priceId, PRICE_IDS.quarterly);
    }
  });

  it('No Zero Pause products → new prices', () => {
    const result = resolveCheckoutPriceForUser(
      { zeroPauseProducts: [] },
      'annual'
    );
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.priceId, PRICE_IDS.annual);
      assert.equal(result.challengePricing, false);
    }
  });

  it('Challenge-active → legacy monthly; quarterly rejected', () => {
    const user = {
      zeroPauseProducts: ['challenge'],
      zeroPauseDate: '2026-07-01T00:00:00.000Z',
      zeroPauseEndDate: '2026-07-31T00:00:00.000Z',
    };
    const now = new Date('2026-07-15T00:00:00.000Z');
    const monthly = resolveCheckoutPriceForUser(user, 'monthly', now);
    assert.equal(monthly.status, 'ok');
    if (monthly.status === 'ok') {
      assert.equal(monthly.priceId, PRICE_IDS.legacy);
      assert.equal(monthly.billingPeriod, 'monthly');
      assert.equal(monthly.challengePricing, true);
    }
    const quarterly = resolveCheckoutPriceForUser(user, 'quarterly', now);
    assert.equal(quarterly.status, 'challenge_period_not_allowed');
  });
});

describe('applyZeroPauseChallengeExpiry', () => {
  it('mutates products to maintainer after end day and keeps dates', () => {
    const user = {
      zeroPauseProducts: ['challenge'],
      zeroPauseDate: '2026-07-01T00:00:00.000Z',
      zeroPauseEndDate: '2026-07-31T00:00:00.000Z',
    };
    const onEndDay = applyZeroPauseChallengeExpiry(
      user,
      new Date('2026-07-31T12:00:00.000Z')
    );
    assert.equal(onEndDay.expired, false);
    assert.deepEqual(user.zeroPauseProducts, ['challenge']);

    const after = applyZeroPauseChallengeExpiry(
      user,
      new Date('2026-08-01T00:00:00.000Z')
    );
    assert.equal(after.expired, true);
    assert.deepEqual(user.zeroPauseProducts, ['maintainer']);
    assert.equal(user.zeroPauseDate, '2026-07-01T00:00:00.000Z');
    assert.equal(user.zeroPauseEndDate, '2026-07-31T00:00:00.000Z');
  });

  it('ensures maintainer when challenge was the only product', () => {
    const user = {
      zeroPauseProducts: ['challenge'],
      zeroPauseDate: '2026-01-01T00:00:00.000Z',
      zeroPauseEndDate: '2026-01-10T00:00:00.000Z',
    };
    const result = applyZeroPauseChallengeExpiry(
      user,
      new Date('2026-01-11T00:00:00.000Z')
    );
    assert.equal(result.expired, true);
    assert.deepEqual(user.zeroPauseProducts, ['maintainer']);
  });
});
