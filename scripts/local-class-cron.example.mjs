/**
 * LOCAL DEV ONLY — copy this file to scripts/local-class-cron.mjs (gitignored).
 *
 * Vercel runs crons automatically in production (vercel.json + CRON_SECRET).
 * During `npm run dev` they do NOT run unless you start your private copy:
 *   node scripts/local-class-cron.mjs
 *
 * Setup:
 *   cp scripts/local-class-cron.example.mjs scripts/local-class-cron.mjs
 *   Set CLASS_REMINDER_CRON_SECRET, CLASS_NPS_CRON_SECRET, DRILL_REMINDER_CRON_SECRET
 *   (or CRON_SECRET) in .env. Optional: CRON_DEBUG=true for verbose cron JSON.
 *
 * Usage:
 *   node scripts/local-class-cron.mjs
 *   node scripts/local-class-cron.mjs --interval 30
 *   node scripts/local-class-cron.mjs --streak-interval 900
 *   node scripts/local-class-cron.mjs --daily-blast-once
 *   node scripts/local-class-cron.mjs --include-daily-blast
 *
 * --include-daily-blast  Fire drill-assigned-reminder at startup + hourly (broadcasts
 *                        to ALL learners with FCM tokens — use sparingly).
 * --daily-blast-once     Fire drill-assigned-reminder once at startup only.
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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base-url' && args[i + 1]) baseUrl = args[++i];
    if (args[i] === '--interval' && args[i + 1])
      intervalSec = Math.max(15, parseInt(args[++i], 10) || 60);
    if (args[i] === '--streak-interval' && args[i + 1])
      streakIntervalSec = Math.max(60, parseInt(args[++i], 10) || 1800);
    if (args[i] === '--include-daily-blast') includeDailyBlast = true;
    if (args[i] === '--daily-blast-once') dailyBlastOnce = true;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    intervalSec,
    streakIntervalSec,
    includeDailyBlast,
    dailyBlastOnce,
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

  try {
    const [reminders, nps] = await Promise.all([
      hitCron(baseUrl, '/api/v1/cron/class-session-reminders', reminderSecret),
      hitCron(baseUrl, '/api/v1/cron/class-session-nps', npsSecret),
    ]);
    summarize('reminders', reminders);
    summarize('nps', nps);
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

async function tickStreakRolling(baseUrl, streakIntervalSec) {
  const drillSecret = resolveSecret(process.env.DRILL_REMINDER_CRON_SECRET);
  const ts = new Date().toLocaleTimeString();

  console.log(`\n[${ts}] ── Drills / streak (every ${formatInterval(streakIntervalSec)}) ──`);

  try {
    const result = await hitCron(
      baseUrl,
      '/api/v1/cron/drill-daily-reminder',
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

  console.log(`\n[${ts}] ── Drills / daily practice ──`);

  try {
    const result = await hitCron(
      baseUrl,
      '/api/v1/cron/drill-assigned-reminder',
      drillSecret,
    );
    summarize('daily-practice', result, { debug: false });
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

const {
  baseUrl,
  intervalSec,
  streakIntervalSec,
  includeDailyBlast,
  dailyBlastOnce,
} = parseArgs();

console.log('Local cron runner (classes + drills) — private copy, not deployed');
console.log(`  base URL: ${baseUrl}`);
console.log(`  classes interval: every ${formatInterval(intervalSec)}`);
console.log(`  streak interval: every ${formatInterval(streakIntervalSec)}`);
if (includeDailyBlast) {
  console.log('  daily practice: at startup + each hour (broadcasts to all FCM learners)');
} else if (dailyBlastOnce) {
  console.log('  daily practice: once at startup only (broadcasts to all FCM learners)');
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

let lastBlastHour = -1;

async function maybeHourlyDailyBlast() {
  if (!includeDailyBlast) return;
  const hour = new Date().getHours();
  if (hour === lastBlastHour) return;
  lastBlastHour = hour;
  await tickDailyPractice(baseUrl);
}

await tickClasses(baseUrl, intervalSec);
await tickStreakRolling(baseUrl, streakIntervalSec);

if (dailyBlastOnce || includeDailyBlast) {
  await tickDailyPractice(baseUrl);
  if (includeDailyBlast) lastBlastHour = new Date().getHours();
}

setInterval(async () => {
  await tickClasses(baseUrl, intervalSec);
  await maybeHourlyDailyBlast();
}, intervalSec * 1000);

setInterval(() => tickStreakRolling(baseUrl, streakIntervalSec), streakIntervalSec * 1000);
