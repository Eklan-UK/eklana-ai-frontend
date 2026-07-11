import { readFileSync } from 'fs';
import path from 'path';
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  Status,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';

export type AppleSubscriptionStatusString =
  | 'active'
  | 'expired'
  | 'billing_retry'
  | 'billing_grace'
  | 'revoked'
  | 'unknown';

export interface VerifiedAppleSubscription {
  originalTransactionId: string;
  latestTransactionId: string;
  productId: string;
  expiresAt: Date | null;
  appleSubscriptionStatus: AppleSubscriptionStatusString;
  environment: Environment;
  appAccountToken?: string;
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n').trim();
}

function getAppleEnvironment(): Environment {
  const raw = config.APPLE_APP_STORE_ENVIRONMENT?.trim().toLowerCase();
  if (raw === 'production') return Environment.PRODUCTION;
  if (raw === 'sandbox') return Environment.SANDBOX;
  throw new Error(
    'APPLE_APP_STORE_ENVIRONMENT is not set. Must be "production" or "sandbox".'
  );
}

function loadAppleRootCertificates(): Buffer[] {
  const certsDir = path.join(process.cwd(), 'src/lib/apple/certs');
  const files = ['AppleRootCA-G3.cer', 'AppleRootCA-G2.cer'];
  return files.map((name) => readFileSync(path.join(certsDir, name)));
}

export function isAppleIapConfigured(): boolean {
  const environment = config.APPLE_APP_STORE_ENVIRONMENT?.trim().toLowerCase();
  if (environment !== 'production' && environment !== 'sandbox') {
    return false;
  }
  if (environment === 'production' && !config.APPLE_APP_APPLE_ID) {
    return false;
  }
  return Boolean(
    config.APPLE_APP_STORE_ISSUER_ID &&
      config.APPLE_APP_STORE_KEY_ID &&
      config.APPLE_APP_STORE_PRIVATE_KEY &&
      config.APPLE_BUNDLE_ID &&
      config.APPLE_PRO_MONTHLY_PRODUCT_ID
  );
}

let apiClient: AppStoreServerAPIClient | null = null;
let verifier: SignedDataVerifier | null = null;

function getApiClient(): AppStoreServerAPIClient {
  if (!isAppleIapConfigured()) {
    throw new Error('Apple In-App Purchase is not configured.');
  }
  if (!apiClient) {
    apiClient = new AppStoreServerAPIClient(
      normalizePrivateKey(config.APPLE_APP_STORE_PRIVATE_KEY!),
      config.APPLE_APP_STORE_KEY_ID!,
      config.APPLE_APP_STORE_ISSUER_ID!,
      config.APPLE_BUNDLE_ID!,
      getAppleEnvironment()
    );
  }
  return apiClient;
}

function getVerifier(): SignedDataVerifier {
  if (!config.APPLE_BUNDLE_ID) {
    throw new Error('APPLE_BUNDLE_ID is not configured.');
  }
  if (!verifier) {
    const env = getAppleEnvironment();
    const appAppleId = config.APPLE_APP_APPLE_ID
      ? Number(config.APPLE_APP_APPLE_ID)
      : undefined;
    verifier = new SignedDataVerifier(
      loadAppleRootCertificates(),
      true,
      env,
      config.APPLE_BUNDLE_ID,
      env === Environment.PRODUCTION ? appAppleId : undefined
    );
  }
  return verifier;
}

export function mapAppleStatus(status?: Status | number): AppleSubscriptionStatusString {
  switch (status) {
    case Status.ACTIVE:
      return 'active';
    case Status.EXPIRED:
      return 'expired';
    case Status.BILLING_RETRY:
      return 'billing_retry';
    case Status.BILLING_GRACE_PERIOD:
      return 'billing_grace';
    case Status.REVOKED:
      return 'revoked';
    default:
      return 'unknown';
  }
}

export function isAppleStatusPremium(status: AppleSubscriptionStatusString): boolean {
  return status === 'active' || status === 'billing_grace' || status === 'billing_retry';
}

/** Apple `expiresDate` is milliseconds since epoch. */
export function expiresDateToDate(expiresDate?: number): Date | null {
  if (expiresDate == null || expiresDate <= 0) return null;
  return new Date(expiresDate);
}

export async function verifyAndDecodeTransactionJws(
  signedTransactionInfo: string
): Promise<JWSTransactionDecodedPayload> {
  return getVerifier().verifyAndDecodeTransaction(signedTransactionInfo);
}

export async function verifyAndDecodeNotificationJws(
  signedPayload: string
): Promise<ResponseBodyV2DecodedPayload> {
  return getVerifier().verifyAndDecodeNotification(signedPayload);
}

export async function verifyAndDecodeRenewalInfoJws(signedRenewalInfo: string) {
  return getVerifier().verifyAndDecodeRenewalInfo(signedRenewalInfo);
}

/** Best expiry from transaction + renewal JWS (ms timestamps). */
export function resolveSubscriptionExpiryDates(
  transaction: JWSTransactionDecodedPayload | null,
  renewal: { gracePeriodExpiresDate?: number; renewalDate?: number } | null
): Date | null {
  const candidates = [
    expiresDateToDate(transaction?.expiresDate),
    expiresDateToDate(renewal?.gracePeriodExpiresDate),
    expiresDateToDate(renewal?.renewalDate),
  ].filter((d): d is Date => d != null);
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, d) => (d.getTime() > latest.getTime() ? d : latest));
}

/**
 * Resolve subscription state from App Store Server API + optional client JWS.
 */
export async function resolveAppleSubscription(input: {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  signedTransactionInfo?: string;
}): Promise<VerifiedAppleSubscription> {
  if (!isAppleIapConfigured()) {
    throw new Error('Apple In-App Purchase is not configured.');
  }

  const expectedProductId = config.APPLE_PRO_MONTHLY_PRODUCT_ID!;
  const client = getApiClient();
  const v = getVerifier();

  let decoded: JWSTransactionDecodedPayload | null = null;

  if (input.signedTransactionInfo) {
    decoded = await v.verifyAndDecodeTransaction(input.signedTransactionInfo);
  }

  const lookupId =
    input.transactionId ||
    input.originalTransactionId ||
    decoded?.transactionId ||
    decoded?.originalTransactionId;

  if (!lookupId) {
    throw new Error('transactionId or originalTransactionId is required.');
  }

  if (!decoded) {
    const txResponse = await client.getTransactionInfo(lookupId);
    if (!txResponse.signedTransactionInfo) {
      throw new Error('App Store did not return signed transaction info.');
    }
    decoded = await v.verifyAndDecodeTransaction(txResponse.signedTransactionInfo);
  }

  const productId = decoded.productId || input.productId;
  if (!productId || productId !== expectedProductId) {
    throw new Error('Product ID does not match the configured Pro subscription.');
  }

  if (decoded.bundleId && decoded.bundleId !== config.APPLE_BUNDLE_ID) {
    throw new Error('Bundle ID does not match APPLE_BUNDLE_ID.');
  }

  const originalTransactionId =
    decoded.originalTransactionId || input.originalTransactionId || lookupId;
  const latestTransactionId = decoded.transactionId || input.transactionId || lookupId;

  let appleSubscriptionStatus: AppleSubscriptionStatusString = 'unknown';
  let expiresAt = expiresDateToDate(decoded.expiresDate);

  try {
    const statusResponse = await client.getAllSubscriptionStatuses(originalTransactionId);
    const group = statusResponse.data?.[0];
    const lastTx = group?.lastTransactions?.find(
      (item) => item.originalTransactionId === originalTransactionId
    ) ?? group?.lastTransactions?.[0];

    if (lastTx) {
      appleSubscriptionStatus = mapAppleStatus(lastTx.status);
      if (lastTx.signedTransactionInfo) {
        const tx = await v.verifyAndDecodeTransaction(lastTx.signedTransactionInfo);
        const fromApi = expiresDateToDate(tx.expiresDate);
        if (fromApi) expiresAt = fromApi;
        if (tx.productId && tx.productId !== expectedProductId) {
          throw new Error('Subscription product ID mismatch.');
        }
      }
    } else if (expiresAt && expiresAt.getTime() > Date.now()) {
      appleSubscriptionStatus = 'active';
    } else if (expiresAt) {
      appleSubscriptionStatus = 'expired';
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[Apple IAP] getAllSubscriptionStatuses failed; using transaction JWS', {
      originalTransactionId,
      error: message,
    });
    if (expiresAt && expiresAt.getTime() > Date.now()) {
      appleSubscriptionStatus = 'active';
    } else if (expiresAt) {
      appleSubscriptionStatus = 'expired';
    }
  }

  if (!isAppleStatusPremium(appleSubscriptionStatus)) {
    if (expiresAt && expiresAt.getTime() > Date.now()) {
      appleSubscriptionStatus = 'active';
    } else if (!expiresAt) {
      throw new Error('No active Apple subscription found for this transaction.');
    }
  }

  return {
    originalTransactionId,
    latestTransactionId,
    productId,
    expiresAt,
    appleSubscriptionStatus,
    environment: getAppleEnvironment(),
    appAccountToken: decoded.appAccountToken,
  };
}
