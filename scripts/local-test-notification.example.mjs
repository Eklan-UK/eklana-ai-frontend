/**
 * LOCAL DEV ONLY — copy this file to scripts/local-test-notification.mjs (gitignored).
 *
 * Sends test notifications through the running Next.js dev server (no ts-node / MongoDB imports).
 *
 * Setup:
 *   cp scripts/local-test-notification.example.mjs scripts/local-test-notification.mjs
 *
 * In .env (already gitignored), set either:
 *   TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD
 * or paste a browser session cookie:
 *   NOTIFICATION_ADMIN_COOKIE=better-auth.session_token=...
 *
 * For drill reminder tests (--drill-daily / --drill-streak), use student credentials:
 *   TEST_STUDENT_EMAIL + TEST_STUDENT_PASSWORD
 * or:
 *   NOTIFICATION_STUDENT_COOKIE=better-auth.session_token=...
 *
 * Prerequisites:
 *   npm run dev   (server must be running)
 *   At least one user has granted push permission (FCM token registered)
 *
 * Usage:
 *   node scripts/local-test-notification.mjs
 *   node scripts/local-test-notification.mjs --in-app <studentUserId>
 *   node scripts/local-test-notification.mjs --drill-daily
 *   node scripts/local-test-notification.mjs --drill-streak
 *   node scripts/local-test-notification.mjs --base-url http://localhost:3000
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv(join(ROOT, '.env'));
loadDotEnv(join(ROOT, '.env.local'));

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let inAppUserId = null;
  let drillDaily = false;
  let drillStreak = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base-url' && args[i + 1]) baseUrl = args[++i];
    if (args[i] === '--in-app' && args[i + 1]) inAppUserId = args[++i];
    if (args[i] === '--drill-daily') drillDaily = true;
    if (args[i] === '--drill-streak') drillStreak = true;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    inAppUserId,
    drillDaily,
    drillStreak,
  };
}

async function signIn(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/api/v1/auth/sign-in/email`, {
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
  if (!cookies.length) {
    throw new Error('Sign-in succeeded but no Set-Cookie header returned');
  }

  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function resolveAdminCookie(baseUrl) {
  const fromEnv = process.env.NOTIFICATION_ADMIN_COOKIE?.trim();
  if (fromEnv) return fromEnv;

  const email = process.env.TEST_ADMIN_EMAIL?.trim();
  const password = process.env.TEST_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    console.error(`
Missing admin auth. Add to .env:

  TEST_ADMIN_EMAIL=admin@example.com
  TEST_ADMIN_PASSWORD=your-password

Or paste your browser session cookie:

  NOTIFICATION_ADMIN_COOKIE=better-auth.session_token=...
`);
    process.exit(1);
  }

  return signIn(baseUrl, email, password);
}

async function resolveStudentCookie(baseUrl) {
  const fromEnv = process.env.NOTIFICATION_STUDENT_COOKIE?.trim();
  if (fromEnv) return fromEnv;

  const email = process.env.TEST_STUDENT_EMAIL?.trim();
  const password = process.env.TEST_STUDENT_PASSWORD?.trim();
  if (!email || !password) {
    console.error(`
Missing student auth for drill reminder tests. Add to .env:

  TEST_STUDENT_EMAIL=student@example.com
  TEST_STUDENT_PASSWORD=your-password

Or paste your browser session cookie:

  NOTIFICATION_STUDENT_COOKIE=better-auth.session_token=...
`);
    process.exit(1);
  }

  return signIn(baseUrl, email, password);
}

async function sendFcmTest(baseUrl, cookie) {
  console.log('\n📨 FCM push test (all users with active tokens)...');

  const res = await fetch(`${baseUrl}/api/v1/fcm/test-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('  ✗ HTTP', res.status, body.error ?? body.message ?? body);
    return false;
  }

  if (body.recipientCount === 0) {
    console.log('  ⚠ No active FCM tokens — log in as a student and allow notifications first');
    return false;
  }

  console.log('  ✓ Sent to', body.recipientCount, 'user(s),', body.tokenCount, 'token(s)');
  console.log('    success:', body.successCount, '| failed:', body.failureCount);
  return true;
}

async function sendInAppTest(baseUrl, cookie, userId) {
  console.log('\n🔔 In-app notification test for user', userId, '...');

  const res = await fetch(`${baseUrl}/api/v1/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      userId,
      title: 'Time to practise! 📚',
      body: 'Local test — check the bell icon or /account/notifications',
      type: 'drill_reminder',
      data: { url: '/account/drills' },
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('  ✗ HTTP', res.status, body.error ?? body.message ?? body);
    return false;
  }

  console.log('  ✓ Created notification', body.notificationId);
  if (body.delivery) {
    console.log('    push sent:', body.delivery.total?.sent ?? 0);
  }
  return true;
}

async function sendDrillReminderTest(baseUrl, cookie, variant) {
  const label = variant === 'daily' ? 'Daily practice' : 'Streak';
  console.log(`\n📚 ${label} drill reminder test...`);

  const res = await fetch(`${baseUrl}/api/v1/dev/drill-reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ variant }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('  ✗ HTTP', res.status, body.message ?? body.error ?? body);
    return false;
  }

  const data = body.data ?? {};
  if (data.sent) {
    console.log('  ✓ Sent');
    if (data.pendingCount !== undefined) {
      console.log('    pending drills:', data.pendingCount);
    }
    if (data.streakDays !== undefined) {
      console.log('    streak days:', data.streakDays);
    }
    return true;
  }

  console.log('  ⚠ Skipped:', data.reason ?? 'unknown');
  return false;
}

const { baseUrl, inAppUserId, drillDaily, drillStreak } = parseArgs();
const drillOnly = drillDaily || drillStreak;

console.log('Local notification tester — private copy, not deployed');
console.log('  base URL:', baseUrl);
console.log('  (requires `npm run dev`)');

try {
  if (drillOnly) {
    const studentCookie = await resolveStudentCookie(baseUrl);
    console.log('  student auth: ok');

    let ok = true;
    if (drillDaily) {
      ok = (await sendDrillReminderTest(baseUrl, studentCookie, 'daily')) && ok;
    }
    if (drillStreak) {
      ok = (await sendDrillReminderTest(baseUrl, studentCookie, 'streak')) && ok;
    }

    console.log('\nNext: check browser push' + (drillStreak ? ' and /account/notifications' : ''));
    process.exit(ok ? 0 : 1);
  }

  const cookie = await resolveAdminCookie(baseUrl);
  console.log('  admin auth: ok');

  const fcmOk = await sendFcmTest(baseUrl, cookie);

  if (inAppUserId) {
    await sendInAppTest(baseUrl, cookie, inAppUserId);
  } else {
    console.log('\nTip: pass --in-app <studentUserId> to also test the in-app bell');
    console.log('Tip: pass --drill-daily or --drill-streak for drill reminder tests');
  }

  console.log('\nNext: check browser for push popup and /account/notifications for in-app list');
  process.exit(fcmOk ? 0 : 1);
} catch (err) {
  console.error('\n❌', err.message);
  process.exit(1);
}
