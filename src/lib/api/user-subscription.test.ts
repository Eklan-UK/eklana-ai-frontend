import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUserSubscribed } from './user-subscription';

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

describe('isUserSubscribed', () => {
  it('returns false for null user', () => {
    assert.equal(isUserSubscribed(null), false);
  });

  it('returns false when plan is free', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'free',
        stripeSubscriptionStatus: 'active',
        subscriptionExpiresAt: future,
      }),
      false
    );
  });

  it('returns true for active stripe with future expiry', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        subscriptionPaymentMethod: 'stripe',
        stripeSubscriptionStatus: 'active',
        subscriptionExpiresAt: future,
      }),
      true
    );
  });

  it('returns false for active stripe with expired expiry (stale status)', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        subscriptionPaymentMethod: 'stripe',
        stripeSubscriptionStatus: 'active',
        subscriptionExpiresAt: past,
      }),
      false
    );
  });

  it('returns false for past_due even with future expiry (immediate revocation)', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        subscriptionPaymentMethod: 'stripe',
        stripeSubscriptionStatus: 'past_due',
        subscriptionExpiresAt: future,
      }),
      false
    );
  });

  it('returns false for canceled with premium plan', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        subscriptionPaymentMethod: 'stripe',
        stripeSubscriptionStatus: 'canceled',
        subscriptionExpiresAt: future,
      }),
      false
    );
  });

  it('returns false for unpaid status', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        stripeSubscriptionStatus: 'unpaid',
        subscriptionExpiresAt: future,
      }),
      false
    );
  });

  it('returns true for apple active status', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        subscriptionPaymentMethod: 'apple',
        appleSubscriptionStatus: 'active',
        subscriptionExpiresAt: future,
      }),
      true
    );
  });

  it('returns true for manual grant with future expiry', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        subscriptionPaymentMethod: 'manual',
        subscriptionExpiresAt: future,
      }),
      true
    );
  });

  it('returns false for manual grant with past expiry', () => {
    assert.equal(
      isUserSubscribed({
        subscriptionPlan: 'premium',
        subscriptionPaymentMethod: 'manual',
        subscriptionExpiresAt: past,
      }),
      false
    );
  });
});
