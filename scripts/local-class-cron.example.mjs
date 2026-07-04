/**
 * LOCAL DEV ONLY — copy this file to scripts/local-class-cron.mjs (gitignored).
 *
 * Vercel runs crons automatically in production (vercel.json + CRON_SECRET).
 * During `npm run dev` they do NOT run unless you start your private copy:
 *   npm run dev:cron
 *
 * Setup:
 *   cp scripts/local-class-cron.example.mjs scripts/local-class-cron.mjs
 *   Set CLASS_REMINDER_CRON_SECRET, CLASS_NPS_CRON_SECRET, DRILL_REMINDER_CRON_SECRET
 *   (or CRON_SECRET) in .env. Optional: CRON_DEBUG=true for verbose cron JSON.
 *
 * Crons exercised (matches vercel.json):
 *   class-session-reminders  — class reminder email + in-app + push (every minute)
 *   class-session-nps        — post-class NPS email + in-app + push (every minute)
 *   drill-streak-reminder    — streak rolling nudge (every 30 min in prod)
 *   drill-daily-practice-reminder — daily drill nudge at 18:00 UTC (6 PM UTC)
 *
 * Usage:
 *   npm run dev:cron
 *   node scripts/local-class-cron.mjs --interval 30
 *   node scripts/local-class-cron.mjs --streak-interval 900
 *   node scripts/local-class-cron.mjs --daily-blast-once
 *   node scripts/local-class-cron.mjs --include-daily-blast
 *   node scripts/local-class-cron.mjs --daily-blast-scheduled-only
 *
 * --daily-blast-once            Fire drill-daily-practice-reminder once at startup.
 * --include-daily-blast         Fire at startup + again each day at 18:00 UTC.
 * --daily-blast-scheduled-only  Wait until 18:00 UTC only (no startup blast).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Production schedule: 18:00 UTC daily (6 PM UTC). */
const DAILY_BLAST_UTC_HOUR = 18;

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
  let includeDailyBlast = false;
  let dailyBlastOnce = false;
  let dailyBlastScheduledOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base-url' && args[i + 1]) baseUrl = args[++i];
    if (args[i] === '--interval' && args[i + 1])
      intervalSec = Math.max(15, parseInt(args[++i], 10) || 60);
    if (args[i] === '--streak-interval' && args[i + 1])
      streakIntervalSec = Math.max(60, parseInt(args[++i], 10) || 1800);
    if (args[i] === '--include-daily-blast') includeDailyBlast = true;
    if (args[i] === '--daily-blast-once') dailyBlastOnce = true;
    if (args[i] === '--daily-blast-scheduled-only') dailyBlastScheduledOnly = true;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    intervalSec,
    streakIntervalSec,
    includeDailyBlast,
    dailyBlastOnce,
    dailyBlastScheduledOnly,
  };
}

function resolveSecret(routeSecret) {
  return routeSecret || process.env.CRON_SECRET || null;
}

async function hitCron(baseUrl, path, secret) {
  if (!secret) {
    return { ok: false, status: 0, body: { message: 'secret not set in .env' } };
  }
  const debugQs =
    process.env.CRON_DEBUG === 'true' ? '?debug=1' : '';
  const url = `${baseUrl}${path}${debugQs}`;
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

async function tickDailyPractice(baseUrl) {
  const drillSecret = resolveSecret(process.env.DRILL_REMINDER_CRON_SECRET);
  const ts = new Date().toLocaleTimeString();

  console.log(`\n[${ts}] ── Drills / daily practice (${DAILY_BLAST_UTC_HOUR}:00 UTC) ──`);
  console.log('  → drill-daily-practice-reminder: in-app + push (all active learners)');

  try {
    const result = await hitCron(
      baseUrl,
      '/api/v1/cron/drill-daily-practice-reminder',
      drillSecret,
    );
    summarize('daily-practice', result, { debug: false });
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

/** True when within ±1 minute of the configured daily blast hour (UTC). */
function isDailyBlastWindow(now = new Date()) {
  return now.getUTCHours() === DAILY_BLAST_UTC_HOUR && now.getUTCMinutes() <= 1;
}

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function formatNextDailyBlast() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(DAILY_BLAST_UTC_HOUR);
  if (now >= next) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

const {
  baseUrl,
  intervalSec,
  streakIntervalSec,
  includeDailyBlast,
  dailyBlastOnce,
  dailyBlastScheduledOnly,
} = parseArgs();

const runScheduledDaily =
  includeDailyBlast || dailyBlastScheduledOnly;

console.log('Local cron runner (classes + drills) — private copy, not deployed');
console.log(`  base URL: ${baseUrl}`);
console.log(`  classes interval: every ${formatInterval(intervalSec)}`);
console.log(`  streak interval: every ${formatInterval(streakIntervalSec)}`);
if (dailyBlastScheduledOnly) {
  console.log(
    `  daily practice: scheduled only at ${DAILY_BLAST_UTC_HOUR}:00 UTC (next: ${formatNextDailyBlast()})`,
  );
} else if (includeDailyBlast) {
  console.log(
    `  daily practice: at startup + daily at ${DAILY_BLAST_UTC_HOUR}:00 UTC`,
  );
} else if (dailyBlastOnce) {
  console.log('  daily practice: once at startup only');
} else {
  console.log(
    `  daily practice: off (use --daily-blast-once, --include-daily-blast, or --daily-blast-scheduled-only)`,
  );
}
console.log(
  '  secrets:',
  resolveSecret(process.env.CLASS_REMINDER_CRON_SECRET) ? 'reminders ✓' : 'reminders ✗',
  resolveSecret(process.env.CLASS_NPS_CRON_SECRET) ? 'nps ✓' : 'nps ✗',
  resolveSecret(process.env.DRILL_REMINDER_CRON_SECRET) ? 'drills ✓' : 'drills ✗',
);
if (process.env.CRON_DEBUG === 'true') {
  console.log('  CRON_DEBUG=true — verbose cron responses enabled');
}
console.log('Press Ctrl+C to stop.\n');

let dailyBlastFiredToday = false;
let lastBlastDay = '';

async function maybeScheduledDailyBlast() {
  if (!runScheduledDaily) return;
  const now = new Date();
  const day = utcDayKey(now);
  if (day === lastBlastDay && dailyBlastFiredToday) return;
  if (!isDailyBlastWindow(now)) return;
  lastBlastDay = day;
  dailyBlastFiredToday = true;
  await tickDailyPractice(baseUrl);
}

await tickClasses(baseUrl, intervalSec);
await tickStreakRolling(baseUrl, streakIntervalSec);

if (dailyBlastOnce || (includeDailyBlast && !dailyBlastScheduledOnly)) {
  await tickDailyPractice(baseUrl);
  if (includeDailyBlast) {
    lastBlastDay = utcDayKey();
    dailyBlastFiredToday = true;
  }
}

setInterval(async () => {
  await tickClasses(baseUrl, intervalSec);
  await maybeScheduledDailyBlast();
}, intervalSec * 1000);

setInterval(() => tickStreakRolling(baseUrl, streakIntervalSec), streakIntervalSec * 1000);
