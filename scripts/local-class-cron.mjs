/**
 * Local dev cron — hits class reminder + NPS cron routes every minute.
 *
 * Vercel runs these automatically in production (vercel.json). During `npm run dev`
 * they do NOT run unless you start this script in a second terminal.
 *
 * Usage:
 *   npm run dev:cron
 *   node scripts/local-class-cron.mjs
 *   node scripts/local-class-cron.mjs --interval 30
 *   node scripts/local-class-cron.mjs --base-url http://localhost:3000
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
  let intervalSec = 60;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base-url' && args[i + 1]) baseUrl = args[++i];
    if (args[i] === '--interval' && args[i + 1])
      intervalSec = Math.max(15, parseInt(args[++i], 10) || 60);
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), intervalSec };
}

async function hitCron(path, secret) {
  if (!secret) {
    return { ok: false, status: 0, body: { message: 'secret not set in .env' } };
  }
  const url = `${path}?debug=1`;
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

function summarize(label, result) {
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
    `examined=${data.examined}`,
    `sent=${data.sent}`,
    `skipped=${data.skipped}`,
  ];
  if (data.errors?.length) parts.push(`errors=${data.errors.length}`);
  console.log(`  ${label}: ${parts.join(', ')}`);
  if (data.debug?.length) {
    for (const d of data.debug) {
      console.log(
        `    → ${d.sessionId?.slice(-6) ?? '?'}: ${d.reason}` +
          (d.minutesUntilStart != null ? ` (${d.minutesUntilStart} min to start)` : '') +
          (d.closestDiffSeconds != null ? `, off by ${d.closestDiffSeconds}s` : ''),
      );
    }
  }
}

async function tick(baseUrl) {
  const reminderSecret = process.env.CLASS_REMINDER_CRON_SECRET;
  const npsSecret = process.env.CLASS_NPS_CRON_SECRET;
  const ts = new Date().toLocaleTimeString();

  console.log(`\n[${ts}] Class cron tick`);

  try {
    const [reminders, nps] = await Promise.all([
      hitCron(`${baseUrl}/api/v1/cron/class-session-reminders`, reminderSecret),
      hitCron(`${baseUrl}/api/v1/cron/class-session-nps`, npsSecret),
    ]);
    summarize('reminders', reminders);
    summarize('nps', nps);
  } catch (err) {
    console.error('  fetch failed — is `npm run dev` running?', err.message);
  }
}

const { baseUrl, intervalSec } = parseArgs();

console.log('Local class cron runner');
console.log(`  base URL: ${baseUrl}`);
console.log(`  interval: every ${intervalSec}s`);
console.log(
  '  secrets:',
  process.env.CLASS_REMINDER_CRON_SECRET ? 'reminders ✓' : 'reminders ✗ (set CLASS_REMINDER_CRON_SECRET)',
  process.env.CLASS_NPS_CRON_SECRET ? 'nps ✓' : 'nps ✗ (set CLASS_NPS_CRON_SECRET)',
);
console.log('Press Ctrl+C to stop.\n');

await tick(baseUrl);
setInterval(() => tick(baseUrl), intervalSec * 1000);
