/**
 * Mobile force-update app-config (see MOBILE_FORCE_UPDATE_CONTRACT.md).
 *
 * Env-driven config for the public `GET /api/v1/mobile/app-config` endpoint.
 * No DB / admin UI — raise minimum versions by changing env and redeploying.
 */

export interface MobileAppConfig {
  minimumIosVersion: string;
  minimumAndroidVersion: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  title: string;
  message: string;
}

// Contract handoff default: initial mins equal the current store version so
// nobody is blocked until ops intentionally raise the floor.
const DEFAULT_MINIMUM_VERSION = '1.3.4';
const DEFAULT_IOS_STORE_URL = 'https://apps.apple.com/app/id6759982033';
const DEFAULT_ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.eklan.ai';
const DEFAULT_TITLE = 'Update required';
const DEFAULT_MESSAGE =
  'A new version of Eklan is required to continue. Please update from the store.';

// Marketing semver only (matches Expo `expo.version`), e.g. "1.3.4".
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function resolveMinimumVersion(rawValue: string | undefined): string {
  const trimmed = rawValue?.trim();
  if (!trimmed || !SEMVER_PATTERN.test(trimmed)) {
    return DEFAULT_MINIMUM_VERSION;
  }
  return trimmed;
}

function resolveString(rawValue: string | undefined, fallback: string): string {
  const trimmed = rawValue?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Build the mobile force-update app-config from env, falling back to
 * contract defaults. Never returns empty minimum versions — an invalid
 * min falls back to `1.3.4` rather than blocking or unblocking everyone.
 */
export function getMobileAppConfig(): MobileAppConfig {
  return {
    minimumIosVersion: resolveMinimumVersion(process.env.MOBILE_MINIMUM_IOS_VERSION),
    minimumAndroidVersion: resolveMinimumVersion(process.env.MOBILE_MINIMUM_ANDROID_VERSION),
    iosStoreUrl: resolveString(process.env.MOBILE_IOS_STORE_URL, DEFAULT_IOS_STORE_URL),
    androidStoreUrl: resolveString(process.env.MOBILE_ANDROID_STORE_URL, DEFAULT_ANDROID_STORE_URL),
    title: resolveString(process.env.MOBILE_FORCE_UPDATE_TITLE, DEFAULT_TITLE),
    message: resolveString(process.env.MOBILE_FORCE_UPDATE_MESSAGE, DEFAULT_MESSAGE),
  };
}
