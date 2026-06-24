import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ServiceAccount } from 'firebase-admin';

/**
 * Load Firebase service account credentials from env.
 *
 * Supports:
 *   FIREBASE_SERVICE_ACCOUNT_PATH — path to the downloaded JSON key file (recommended locally)
 *   FIREBASE_SERVICE_ACCOUNT — inline JSON string (common on Vercel)
 */
export function loadFirebaseServiceAccount(): ServiceAccount {
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  let jsonStr: string | undefined;

  if (pathEnv) {
    const filePath = resolve(pathEnv);
    if (!existsSync(filePath)) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_PATH file not found: ${filePath}`,
      );
    }
    jsonStr = readFileSync(filePath, 'utf8');
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (!raw) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT is not set. Paste the full service account JSON, ' +
          'or set FIREBASE_SERVICE_ACCOUNT_PATH to your downloaded key file.',
      );
    }
    jsonStr = raw;
  }

  jsonStr = jsonStr.trim();

  if (
    (jsonStr.startsWith('"') && jsonStr.endsWith('"')) ||
    (jsonStr.startsWith("'") && jsonStr.endsWith("'"))
  ) {
    jsonStr = jsonStr.slice(1, -1);
  }

  // .env often stores newlines in private_key as literal \n
  jsonStr = jsonStr.replace(/\\n/g, '\n');

  if (jsonStr.length < 20 || jsonStr === '{') {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT looks truncated (expected full JSON object). ' +
        'Download the key from Firebase Console → Project settings → Service accounts, ' +
        'then set FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/key.json in .env',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    const hint =
      error instanceof Error ? error.message : 'invalid JSON';
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT is not valid JSON (${hint}). ` +
        'Use FIREBASE_SERVICE_ACCOUNT_PATH pointing to the downloaded .json file instead.',
    );
  }

  const serviceAccount = parsed as ServiceAccount;
  if (!serviceAccount.project_id) {
    throw new Error(
      'Service account JSON is missing "project_id". Ensure you have the correct Firebase key.',
    );
  }

  return serviceAccount;
}
