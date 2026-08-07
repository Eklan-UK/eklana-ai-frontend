/**
 * LOCAL DEV ONLY — copy this file to scripts/local-class-cron.mjs (gitignored).
 *
 * Vercel runs crons automatically in production (vercel.json + CRON_SECRET).
 * During `npm run dev` they do NOT run unless you start your private copy:
 *   npm run dev:cron
 *
 * Setup:
 *   cp scripts/local-class-cron.example.mjs scripts/local-class-cron.mjs
 *   Set CLASS_REMINDER_CRON_SECRET, CLASS_NPS_CRON_SECRET, DRILL_REMINDER_CRON_SECRET,
 *   WEEKLY_DRILL_DIGEST_CRON_SECRET (or CRON_SECRET) in .env.
 *   Optional: CRON_DEBUG=true for verbose cron JSON.
 *
 * Crons exercised (matches vercel.json):
 *   class-session-reminders       — class reminder email + in-app + push (every minute)
 *   class-session-nps             — post-class NPS email + in-app + push (every minute)
 *   drill-streak-reminder         — streak rolling nudge (every 30 min in prod)
 *   drill-daily-practice-reminder — hourly local 6 PM practice nudge (0 * * * * UTC)
 *   weekly-drill-digest           — weekly outstanding-drills digest at Monday 09:00 UTC
 *
 * Usage:
 *   npm run dev:cron
 *   node scripts/local-class-cron.mjs --interval 30
 *   node scripts/local-class-cron.mjs --streak-interval 900
 *   node scripts/local-class-cron.mjs --daily-practice-once
 *   node scripts/local-class-cron.mjs --include-daily-practice
 *   node scripts/local-class-cron.mjs --daily-practice-interval 3600
 *   node scripts/local-class-cron.mjs --simulate-timezone America/New_York
 *   node scripts/local-class-cron.mjs --weekly-digest-once
 *   node scripts/local-class-cron.mjs --weekly-digest-scheduled-only
 *
 * --daily-practice-once            Fire drill-daily-practice-reminder once at startup.
 * --include-daily-practice         Fire at startup + on each hourly tick.
 * --daily-practice-interval 3600   Hourly tick interval in seconds (default 3600).
 * --simulate-timezone <IANA>       Pass ?debug=1&timezone=... for single-learner dev tests.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Production schedule: Monday 09:00 UTC. */
const WEEKLY_DIGEST_UTC_HOUR = 9;

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

function formatInterval(sec) {
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let intervalSec = 60;
  let streakIntervalSec = 1800;
  let dailyPracticeIntervalSec = 3600;
  let includeDailyPractice = false;
  let dailyPracticeOnce = false;
  let simulateTimezone = null;
  let weeklyDigestOnce = false;
  let weeklyDigestScheduledOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base-url' && args[i + 1]) baseUrl = args[++i];
    if (args[i] === '--interval' && args[i + 1])
      intervalSec = Math.max(15, parseInt(args[++i], 10) || 60);
    if (args[i] === '--streak-interval' && args[i + 1])
      streakIntervalSec = Math.max(60, parseInt(args[++i], 10) || 1800);
    if (args[i] === '--daily-practice-interval' && args[i + 1])
      dailyPracticeIntervalSec = Math.max(60, parseInt(args[++i], 10) || 3600);
    if (args[i] === '--include-daily-practice') includeDailyPractice = true;
    if (args[i] === '--daily-practice-once') dailyPracticeOnce = true;
    if (args[i] === '--simulate-timezone' && args[i + 1])
      simulateTimezone = args[++i];
    if (args[i] === '--weekly-digest-once') weeklyDigestOnce = true;
    if (args[i] === '--weekly-digest-scheduled-only') weeklyDigestScheduledOnly = true;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    intervalSec,
    streakIntervalSec,
    dailyPracticeIntervalSec,
    includeDailyPractice,
    dailyPracticeOnce,
    simulateTimezone,
    weeklyDigestOnce,
    weeklyDigestScheduledOnly,
  };
}

function resolveSecret(routeSecret) {
  return routeSecret || process.env.CRON_SECRET || null;
}

function buildCronQuery(path, { simulateTimezone } = {}) {
  const params = new URLSearchParams();
  if (process.env.CRON_DEBUG === 'true') {
    params.set('debug', '1');
  }
  if (simulateTimezone) {
    params.set('timezone', simulateTimezone);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function hitCron(baseUrl, path, secret, options = {}) {
  if (!secret) {
    return { ok: false, status: 0, body: { message: 'secret not set in .env' } };
  }
  const url = `${baseUrl}${buildCronQuery(path, options)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = { message: await res.text() };
  }
  return { ok: res.ok, status: res.status, body };
}

function summarize(label, result, { debug = true } = {}) {
  const data = result.body?.data;
  if (!result.ok) {
    console.log(`  ${label}: HTTP ${result.status}`, result.body?.message ?? result.body);
    return;
  }
  if (!data) {
    console.log(`  ${label}:`, result.body);
    return;
  }
  const parts = [
    `examined=${data.examined ?? '—'}`,
    `sent=${data.sent ?? '—'}`,
    `skipped=${data.skipped ?? '—'}`,
  ];
  const errCount = data.errorCount ?? data.errors?.length ?? 0;
  if (errCount) parts.push(`errors=${errCount}`);
  console.log(`  ${label}: ${parts.join(', ')}`);
  if (data.errors?.length) {
    for (const e of data.errors) console.log(`    ✗ ${e}`);
  }
  if (debug && data.debug?.length) {
    for (const d of data.debug) {
      console.log(`    → ${JSON.stringify(d)}`);
    }
  }
}

async function tickClasses(baseUrl, intervalSec) {
  const reminderSecret = resolveSecret(process.env.CLASS_REMINDER_CRON_SECRET);
  const npsSecret = resolveSecret(process.env.CLASS_NPS_CRON_SECRET);
  const ts = new Date().toLocaleTimeString();

  console.log(`\n[${ts}] ── Classes (every ${formatInterval(intervalSec)}) ──`);
  console.log('  → class-session-reminders: email + in-app + push');
  console.log('  → class-session-nps: post-class NPS email + in-app + push');

  try {
    const [reminders, nps] = await Promise.all([
      hitCron(baseUrl, '/api/v1/cron/class-session-reminders', reminderSecret),
      hitCron(baseUrl, '/api/v1/cron/class-session-nps', npsSecret),
    ]);
    summarize('class-reminders', reminders);
    summarize('class-nps', nps);
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

async function tickStreakRolling(baseUrl, streakIntervalSec) {
  const drillSecret = resolveSecret(process.env.DRILL_REMINDER_CRON_SECRET);
  const ts = new Date().toLocaleTimeString();

  console.log(`\n[${ts}] ── Drills / streak (every ${formatInterval(streakIntervalSec)}) ──`);
  console.log('  → drill-streak-reminder: in-app + push (rolling 24h window)');

  try {
    const result = await hitCron(
      baseUrl,
      '/api/v1/cron/drill-streak-reminder',
      drillSecret,
    );
    summarize('streak-rolling', result, { debug: false });
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

async function tickDailyPractice(baseUrl, simulateTimezone) {
  const drillSecret = resolveSecret(process.env.DRILL_REMINDER_CRON_SECRET);
  const ts = new Date().toLocaleTimeString();

  console.log(`\n[${ts}] ── Drills / daily practice (hourly local 6 PM) ──`);
  console.log('  → drill-daily-practice-reminder: in-app + push (learners at local hour 18)');
  if (simulateTimezone) {
    console.log(`  → dev timezone override: ${simulateTimezone}`);
  }

  try {
    const result = await hitCron(
      baseUrl,
      '/api/v1/cron/drill-daily-practice-reminder',
      drillSecret,
      { simulateTimezone },
    );
    summarize('daily-practice', result);
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

async function tickWeeklyDrillDigest(baseUrl) {
  const digestSecret = resolveSecret(process.env.WEEKLY_DRILL_DIGEST_CRON_SECRET);
  const ts = new Date().toLocaleTimeString();

  console.log(`\n[${ts}] ── Drills / weekly digest (Monday ${WEEKLY_DIGEST_UTC_HOUR}:00 UTC) ──`);
  console.log('  → weekly-drill-digest: email + in-app + push');

  try {
    const result = await hitCron(
      baseUrl,
      '/api/v1/cron/weekly-drill-digest',
      digestSecret,
    );
    summarize('weekly-drill-digest', result);
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

/** True when Monday 09:00 UTC ±1 minute. */
function isWeeklyDigestWindow(now = new Date()) {
  return (
    now.getUTCDay() === 1 &&
    now.getUTCHours() === WEEKLY_DIGEST_UTC_HOUR &&
    now.getUTCMinutes() <= 1
  );
}

function isoWeekKey(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function formatNextWeeklyDigest() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(WEEKLY_DIGEST_UTC_HOUR);
  let daysUntilMonday = (1 - now.getUTCDay() + 7) % 7;
  if (daysUntilMonday === 0) {
    const pastWindow =
      now.getUTCHours() > WEEKLY_DIGEST_UTC_HOUR ||
      (now.getUTCHours() === WEEKLY_DIGEST_UTC_HOUR && now.getUTCMinutes() > 1);
    if (pastWindow) daysUntilMonday = 7;
  }
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  return next.toISOString();
}

const {
  baseUrl,
  intervalSec,
  streakIntervalSec,
  dailyPracticeIntervalSec,
  includeDailyPractice,
  dailyPracticeOnce,
  simulateTimezone,
  weeklyDigestOnce,
  weeklyDigestScheduledOnly,
} = parseArgs();

const runHourlyDailyPractice = includeDailyPractice || dailyPracticeOnce;

console.log('Local cron runner (classes + drills) — private copy, not deployed');
console.log(`  base URL: ${baseUrl}`);
console.log(`  classes interval: every ${formatInterval(intervalSec)}`);
console.log(`  streak interval: every ${formatInterval(streakIntervalSec)}`);
if (includeDailyPractice) {
  console.log(
    `  daily practice: at startup + every ${formatInterval(dailyPracticeIntervalSec)}`,
  );
} else if (dailyPracticeOnce) {
  console.log('  daily practice: once at startup only');
} else {
  console.log(
    '  daily practice: off (use --daily-practice-once or --include-daily-practice)',
  );
}
if (simulateTimezone) {
  console.log(`  simulate timezone: ${simulateTimezone} (requires CRON_DEBUG=true for override)`);
}
if (weeklyDigestScheduledOnly) {
  console.log(
    `  weekly digest: scheduled only Monday ${WEEKLY_DIGEST_UTC_HOUR}:00 UTC (next: ${formatNextWeeklyDigest()})`,
  );
} else if (weeklyDigestOnce) {
  console.log('  weekly digest: once at startup only');
} else {
  console.log(
    '  weekly digest: off (use --weekly-digest-once or --weekly-digest-scheduled-only)',
  );
}
console.log(
  '  secrets:',
  resolveSecret(process.env.CLASS_REMINDER_CRON_SECRET) ? 'reminders ✓' : 'reminders ✗',
  resolveSecret(process.env.CLASS_NPS_CRON_SECRET) ? 'nps ✓' : 'nps ✗',
  resolveSecret(process.env.DRILL_REMINDER_CRON_SECRET) ? 'drills ✓' : 'drills ✗',
  resolveSecret(process.env.WEEKLY_DRILL_DIGEST_CRON_SECRET) ? 'weekly-digest ✓' : 'weekly-digest ✗',
);
if (process.env.CRON_DEBUG === 'true') {
  console.log('  CRON_DEBUG=true — verbose cron responses enabled');
}
console.log('Press Ctrl+C to stop.\n');

let weeklyDigestFiredThisWeek = false;
let lastDigestWeek = '';

async function maybeScheduledWeeklyDigest() {
  if (!weeklyDigestScheduledOnly) return;
  const now = new Date();
  const week = isoWeekKey(now);
  if (week === lastDigestWeek && weeklyDigestFiredThisWeek) return;
  if (!isWeeklyDigestWindow(now)) return;
  lastDigestWeek = week;
  weeklyDigestFiredThisWeek = true;
  await tickWeeklyDrillDigest(baseUrl);
}

await tickClasses(baseUrl, intervalSec);
await tickStreakRolling(baseUrl, streakIntervalSec);

if (dailyPracticeOnce || includeDailyPractice) {
  await tickDailyPractice(baseUrl, simulateTimezone);
}

if (weeklyDigestOnce && !weeklyDigestScheduledOnly) {
  await tickWeeklyDrillDigest(baseUrl);
  lastDigestWeek = isoWeekKey();
  weeklyDigestFiredThisWeek = true;
}

setInterval(async () => {
  await tickClasses(baseUrl, intervalSec);
  await maybeScheduledWeeklyDigest();
}, intervalSec * 1000);

setInterval(() => tickStreakRolling(baseUrl, streakIntervalSec), streakIntervalSec * 1000);

if (includeDailyPractice) {
  setInterval(
    () => tickDailyPractice(baseUrl, simulateTimezone),
    dailyPracticeIntervalSec * 1000,
  );
}
