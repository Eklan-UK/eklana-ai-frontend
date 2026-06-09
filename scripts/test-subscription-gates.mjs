/**
 * Subscription Gate Integration Test
 *
 * Verifies that all Stripe-gated API endpoints:
 *   - Return 402 SubscriptionRequired for a FREE-tier student
 *   - Return a non-402 status for a PREMIUM-tier student
 *
 * Does NOT connect to MongoDB directly — uses the app's own admin API
 * to upgrade/downgrade the test user, so it works against any environment.
 *
 * Prerequisites:
 *   1. An admin account in .env (TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD)
 *   2. A student account in .env (TEST_STUDENT_EMAIL + TEST_STUDENT_PASSWORD)
 *
 * Usage:
 *   node scripts/test-subscription-gates.mjs
 *   node scripts/test-subscription-gates.mjs --base-url https://staging.eklan.ai
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Parse a .env file without any external deps. */
function loadDotEnv(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const dotenv = loadDotEnv(join(ROOT, '.env'));

function getArg(flag, envKey, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return dotenv[envKey] || process.env[envKey] || fallback;
}

const BASE_URL       = getArg('--base-url',  'NEXT_PUBLIC_API_URL', 'http://localhost:3000');
const ADMIN_EMAIL    = getArg('--admin-email',    'TEST_ADMIN_EMAIL', '');
const ADMIN_PASSWORD = getArg('--admin-password', 'TEST_ADMIN_PASSWORD', '');
const STUDENT_EMAIL  = getArg('--email',    'TEST_STUDENT_EMAIL', '');
const STUDENT_PASS   = getArg('--password', 'TEST_STUDENT_PASSWORD', '');

// ── Gated routes under test ────────────────────────────────────────────────────

const GATED_ROUTES = [
  { label: 'Free Talk — greeting',     method: 'GET',  path: '/api/v1/ai/free-talk/greeting' },
  { label: 'Free Talk — scenario list', method: 'GET', path: '/api/v1/ai/free-talk/scenarios' },
  { label: 'Free Talk — conversation', method: 'POST', path: '/api/v1/ai/conversation',       body: { message: 'hello', conversationHistory: [] } },
];

// ── Console helpers ───────────────────────────────────────────────────────────

const R = '\x1b[0m', G = '\x1b[32m', RED = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', D = '\x1b[2m';
let passed = 0, failed = 0;

const pass  = (m) => { console.log(`  ${G}✓${R} ${m}`); passed++; };
const fail  = (m) => { console.log(`  ${RED}✗${R} ${m}`); failed++; };
const info  = (m) => console.log(`  ${D}→${R} ${m}`);
const hdr   = (m) => console.log(`\n${B}${m}${R}`);

function assert(ok, passMsg, failMsg) {
  ok ? pass(passMsg) : fail(failMsg);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** Sign in via better-auth and return the raw "name=value" session cookie. */
async function signIn(email, password) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sign-in failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const cookies = res.headers.getSetCookie?.() ?? [];
  if (!cookies.length) throw new Error('Sign-in succeeded but no Set-Cookie header returned');

  // Return all cookies as a single Cookie header value (name=value pairs)
  return cookies.map(c => c.split(';')[0]).join('; ');
}

/** GET /api/v1/users/current — returns the user object. */
async function getCurrentUser(cookie) {
  const res = await fetch(`${BASE_URL}/api/v1/users/current`, {
    headers: { Cookie: cookie },
  });
  const body = await res.json().catch(() => ({}));
  return body?.user ?? body;
}

/** Use the admin subscription API to set a user's plan. */
async function setSubscriptionViaAdminApi(adminCookie, userId, plan) {
  const body = plan === 'premium'
    ? { userId, plan: 'premium', months: 1, paymentMethod: 'test-script', note: 'Integration test — auto-cleanup' }
    : { userId, plan: 'free',    months: 0 };

  const res = await fetch(`${BASE_URL}/api/v1/admin/users/subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Admin subscription API failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

/**
 * Simulate what the Stripe webhook does:
 * Set stripeSubscriptionStatus=active via the admin subscription API,
 * then patch stripeSubscriptionStatus directly via a dedicated endpoint if available,
 * or fall back to a second admin API call.
 *
 * Note: the admin subscription API sets subscriptionPlan + expiry.
 * stripeSubscriptionStatus is set by the webhook handler. For the test
 * we rely on isUserSubscribed's expiry-date path (which the admin API sets).
 */
async function upgradeToPremium(adminCookie, userId) {
  await setSubscriptionViaAdminApi(adminCookie, userId, 'premium');
}

async function downgradeToFree(adminCookie, userId) {
  await setSubscriptionViaAdminApi(adminCookie, userId, 'free');
}

/** Call one gated route and return the HTTP status code. */
async function callRoute(route, cookie) {
  const res = await fetch(`${BASE_URL}${route.path}`, {
    method: route.method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: route.body ? JSON.stringify(route.body) : undefined,
    redirect: 'manual',
  });
  return res.status;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${B}Eklan AI — Subscription Gate Integration Tests${R}`);
  console.log(`${D}Target: ${BASE_URL}${R}`);

  // ── Pre-flight ─────────────────────────────────────────────────────────────
  hdr('Pre-flight');

  const missing = [];
  if (!ADMIN_EMAIL)    missing.push('TEST_ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('TEST_ADMIN_PASSWORD');
  if (!STUDENT_EMAIL)  missing.push('TEST_STUDENT_EMAIL');
  if (!STUDENT_PASS)   missing.push('TEST_STUDENT_PASSWORD');

  if (missing.length) {
    fail(`Missing env vars: ${missing.join(', ')}`);
    console.log(`\n${Y}Add to your .env:${R}`);
    console.log('  TEST_ADMIN_EMAIL=admin@example.com');
    console.log('  TEST_ADMIN_PASSWORD=adminpassword');
    console.log('  TEST_STUDENT_EMAIL=student@example.com');
    console.log('  TEST_STUDENT_PASSWORD=studentpassword\n');
    process.exit(1);
  }

  // Check server is reachable
  try {
    const ping = await fetch(`${BASE_URL}/api/v1/users/current`, { redirect: 'manual' });
    info(`Server reachable — responded with ${ping.status}`);
  } catch (err) {
    fail(`Cannot reach ${BASE_URL} — is the server running? (${err.message})`);
    process.exit(1);
  }

  // Sign in as admin
  let adminCookie;
  try {
    adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    pass('Admin signed in');
  } catch (err) {
    fail(`Admin sign-in failed: ${err.message}`);
    process.exit(1);
  }

  // Verify admin access
  const adminUser = await getCurrentUser(adminCookie);
  assert(
    adminUser?.role === 'admin',
    `Admin role confirmed (${adminUser?.role})`,
    `Expected role=admin, got "${adminUser?.role}" — TEST_ADMIN_EMAIL must be an admin account`
  );
  if (adminUser?.role !== 'admin') process.exit(1);

  // Sign in as student
  let studentCookie;
  try {
    studentCookie = await signIn(STUDENT_EMAIL, STUDENT_PASS);
    pass('Student signed in');
  } catch (err) {
    fail(`Student sign-in failed: ${err.message}`);
    process.exit(1);
  }

  const studentUser = await getCurrentUser(studentCookie);
  if (!studentUser?._id) {
    fail('Could not fetch student user from /api/v1/users/current');
    process.exit(1);
  }
  const studentId = String(studentUser._id);
  info(`Student: ${studentUser.email} (id: ${studentId})`);

  // ── Phase 1: Ensure free tier ──────────────────────────────────────────────
  hdr('Phase 1 — Set student to FREE tier');
  try {
    await downgradeToFree(adminCookie, studentId);
    pass('Student downgraded to free via admin API');
  } catch (err) {
    fail(`Failed to downgrade: ${err.message}`);
    process.exit(1);
  }

  // ── Phase 2: FREE user must be blocked ────────────────────────────────────
  hdr('Phase 2 — FREE user should get 402 on all gated routes');

  for (const route of GATED_ROUTES) {
    const status = await callRoute(route, studentCookie);
    assert(
      status === 402,
      `[FREE]  ${route.label}  →  ${status}  ✓ blocked`,
      `[FREE]  ${route.label}  →  ${status}  ✗ expected 402 — route is NOT gated!`
    );
  }

  // ── Phase 3: Upgrade to premium ───────────────────────────────────────────
  hdr('Phase 3 — Upgrade student to PREMIUM');
  try {
    await upgradeToPremium(adminCookie, studentId);
    pass('Student upgraded to premium via admin API (1 month expiry)');
  } catch (err) {
    fail(`Failed to upgrade: ${err.message}`);
    process.exit(1);
  }

  // ── Phase 4: PREMIUM user must have access ────────────────────────────────
  hdr('Phase 4 — PREMIUM user should NOT get 402 on gated routes');

  for (const route of GATED_ROUTES) {
    const status = await callRoute(route, studentCookie);
    const ok = status !== 402 && status !== 401;
    assert(
      ok,
      `[PRO]   ${route.label}  →  ${status}  ✓ accessible`,
      `[PRO]   ${route.label}  →  ${status}  ✗ still blocked — subscription gate bug!`
    );
  }

  // ── Phase 5: /api/v1/users/current should report correct state ─────────────
  hdr('Phase 5 — /api/v1/users/current reports correct subscription state');

  const me = await getCurrentUser(studentCookie);
  assert(me?.subscriptionPlan === 'premium',  `subscriptionPlan = "${me?.subscriptionPlan}"`, `subscriptionPlan = "${me?.subscriptionPlan}" (expected "premium")`);
  assert(me?.isSubscribed === true,           `isSubscribed = true`,                           `isSubscribed = ${me?.isSubscribed} (expected true)`);
  assert(!!me?.subscriptionExpiresAt,         `subscriptionExpiresAt is set`,                  `subscriptionExpiresAt is null/undefined`);

  // ── Phase 6: Cleanup ──────────────────────────────────────────────────────
  hdr('Phase 6 — Cleanup: reset student back to FREE');
  try {
    await downgradeToFree(adminCookie, studentId);
    pass('Student reset to free');
  } catch (err) {
    fail(`Cleanup failed: ${err.message} — manually reset ${studentId} to free`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  hdr('Summary');
  console.log(`  ${G}${passed}${R} passed  ${failed > 0 ? RED : ''}${failed}${R} failed  out of ${passed + failed} assertions\n`);

  if (failed > 0) {
    console.log(`${RED}${B}Some tests failed. See above for details.${R}\n`);
    process.exit(1);
  } else {
    console.log(`${G}${B}All tests passed — payment gating is working correctly.${R}\n`);
  }
}

main().catch((err) => {
  console.error(`\n${RED}Unexpected error:${R}`, err.message);
  process.exit(1);
});
