import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { showTrialBanner, subscribeCtaLabel } from './subscription-trial-ui';

describe('showTrialBanner', () => {
  it('returns true when eligible for trial', () => {
    assert.equal(showTrialBanner(true), true);
  });

  it('returns false when not eligible for trial', () => {
    assert.equal(showTrialBanner(false), false);
  });
});

describe('subscribeCtaLabel', () => {
  it('returns Start free trial when eligible', () => {
    assert.equal(subscribeCtaLabel(true), 'Start free trial');
  });

  it('returns Subscribe when not eligible', () => {
    assert.equal(subscribeCtaLabel(false), 'Subscribe');
  });
});
