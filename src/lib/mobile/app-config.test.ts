import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getMobileAppConfig } from './app-config';

const ENV_KEYS = [
  'MOBILE_MINIMUM_IOS_VERSION',
  'MOBILE_MINIMUM_ANDROID_VERSION',
  'MOBILE_IOS_STORE_URL',
  'MOBILE_ANDROID_STORE_URL',
  'MOBILE_FORCE_UPDATE_TITLE',
  'MOBILE_FORCE_UPDATE_MESSAGE',
] as const;

const CONTRACT_DEFAULTS = {
  minimumIosVersion: '1.3.4',
  minimumAndroidVersion: '1.3.4',
  iosStoreUrl: 'https://apps.apple.com/app/id6759982033',
  androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.eklan.ai',
  title: 'Update required',
  message: 'A new version of Eklan is required to continue. Please update from the store.',
};

describe('getMobileAppConfig', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
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

  it('returns contract defaults when env is unset', () => {
    assert.deepEqual(getMobileAppConfig(), CONTRACT_DEFAULTS);
  });

  it('lets env overrides win for every field', () => {
    process.env.MOBILE_MINIMUM_IOS_VERSION = '1.4.0';
    process.env.MOBILE_MINIMUM_ANDROID_VERSION = '1.5.2';
    process.env.MOBILE_IOS_STORE_URL = 'https://apps.apple.com/app/id999';
    process.env.MOBILE_ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.example';
    process.env.MOBILE_FORCE_UPDATE_TITLE = 'Please update';
    process.env.MOBILE_FORCE_UPDATE_MESSAGE = 'Custom message';

    assert.deepEqual(getMobileAppConfig(), {
      minimumIosVersion: '1.4.0',
      minimumAndroidVersion: '1.5.2',
      iosStoreUrl: 'https://apps.apple.com/app/id999',
      androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.example',
      title: 'Please update',
      message: 'Custom message',
    });
  });

  it('falls back to 1.3.4 when a minimum version is empty', () => {
    process.env.MOBILE_MINIMUM_IOS_VERSION = '';
    process.env.MOBILE_MINIMUM_ANDROID_VERSION = '   ';

    const config = getMobileAppConfig();
    assert.equal(config.minimumIosVersion, '1.3.4');
    assert.equal(config.minimumAndroidVersion, '1.3.4');
  });

  it('falls back to 1.3.4 when a minimum version is invalid (non-semver)', () => {
    process.env.MOBILE_MINIMUM_IOS_VERSION = 'not-a-version';
    process.env.MOBILE_MINIMUM_ANDROID_VERSION = 'v1.3.5';

    const config = getMobileAppConfig();
    assert.equal(config.minimumIosVersion, '1.3.4');
    assert.equal(config.minimumAndroidVersion, '1.3.4');
  });

  it('trims whitespace around a valid minimum version', () => {
    process.env.MOBILE_MINIMUM_IOS_VERSION = '  1.4.1  ';

    const config = getMobileAppConfig();
    assert.equal(config.minimumIosVersion, '1.4.1');
  });

  it('falls back to defaults for empty optional string overrides', () => {
    process.env.MOBILE_IOS_STORE_URL = '   ';
    process.env.MOBILE_FORCE_UPDATE_TITLE = '';

    const config = getMobileAppConfig();
    assert.equal(config.iosStoreUrl, CONTRACT_DEFAULTS.iosStoreUrl);
    assert.equal(config.title, CONTRACT_DEFAULTS.title);
  });
});
