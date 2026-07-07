# iOS Payment System — Full Audit Report

**Prepared for:** Mobile Development Team (Expo / React Native)  
**Audit date:** 7 July 2026  
**Backend repository:** `eklana-ai-frontend` (Next.js)  
**Audit agents:** Three specialist backend agents (Apple IAP / Webhook, Email & Identity, Subscription Reconciliation)

---

## Executive Summary

A full audit of the iOS payment system was conducted across the backend API, Apple IAP service layer, authentication flow, and subscription reconciliation logic. Two confirmed root causes are responsible for **every real-money iOS payment failing in production**: the App Store environment is hardcoded to `sandbox`, causing all live App Store JWS tokens to be rejected before any subscription is recorded; and only the monthly product ID is accepted, so any annual or quarterly purchase results in an immediate HTTP 400 before Apple's API is even consulted. Students pay Apple but the app never unlocks.

Beyond these blockers, the audit uncovered a critical identity mismatch that affects `appAccountToken` usage in StoreKit 2: mobile users created through the `/api/v1/auth/verify-id-token` endpoint receive MongoDB ObjectId `_id` values (24-character hex strings), whereas Apple requires `appAccountToken` to be a **UUID v4**. If the mobile app passes `user.id` directly as `appAccountToken`, every purchase attempt is rejected by Apple before the backend is ever called. The current backend documentation (`MOBILE_EXPO_BILLING.md`) contains no guidance on `appAccountToken` at all, leaving the mobile team without direction.

**Primary action items for the mobile team:** (1) do not pass `user.id` as `appAccountToken` unless you have verified it is a UUID v4 — generate your own UUID v4 and store it; (2) always send `signedTransactionInfo` (the JWS string from StoreKit 2) to `POST /api/v1/apple/verify`; (3) treat any non-200 response from that endpoint as a hard failure. **Primary action items for the backend team:** flip `APPLE_APP_STORE_ENVIRONMENT` to `production`, add `APPLE_APP_APPLE_ID` to the IAP configuration check, and expand product ID validation to accept annual/quarterly plans.

---

## Status: Fixed (as of this implementation)

The backend code fixes below have been implemented (see the `iOS Payment Identity and Sandbox Fix` plan). Human-supplied credential fixes and mobile app changes are still outstanding — see the unchecked items and the note at the end of this section.

- [x] **RC-1** — sandbox environment fallback removed; `getAppleEnvironment()` now throws if `APPLE_APP_STORE_ENVIRONMENT` is unset or not exactly `sandbox`/`production`, instead of silently defaulting to sandbox.
- [x] **A-1** — `isAppleIapConfigured()` now also requires `APPLE_APP_APPLE_ID` when `APPLE_APP_STORE_ENVIRONMENT=production`.
- [x] **F-1 / F-2** — new `user.iapAccountToken` UUID v4 field decouples Apple's `appAccountToken` from the `_id` format mismatch (MongoDB ObjectId vs UUID), lazily generated on login and profile fetch.
- [x] **A-2** — the Apple webhook now falls back to looking up the user by `iapAccountToken` (decoded from the transaction JWS) when `appleOriginalTransactionId` isn't yet linked, fixing the race condition where a webhook fires before `/apple/verify` runs.
- [x] **A-4** — the Apple ID token from Sign in with Apple is now cryptographically verified against Apple's JWKS (`https://appleid.apple.com/auth/keys`), checking issuer/audience/expiry, instead of being decoded without verification.
- [x] **A-5** — the synthetic `@privaterelay.appleid.com` fake email is replaced with a safe, non-colliding internal placeholder; email is also normalized (trimmed/lowercased) before storage.
- [ ] **RC-2** (multi-product-ID / annual & quarterly plan support) — explicitly out of scope for this fix, not changed.
- [ ] Corrupted `APPLE_APP_STORE_PRIVATE_KEY` in `.env` and the unverified `APPLE_PRO_MONTHLY_PRODUCT_ID` value — these still require a human to supply/verify the correct values from App Store Connect; there is nothing further to fix in code.

**Mobile app changes are still required:** StoreKit purchases must pass `user.iapAccountToken` as the `appAccountToken` option — see [`appAccountToken` requirement (iOS) in docs/MOBILE_EXPO_BILLING.md](./MOBILE_EXPO_BILLING.md#appaccounttoken-requirement-ios).

---

## Audit Scope

| Area | Files Audited |
|---|---|
| Apple IAP service | `src/services/apple-app-store.service.ts` |
| Apple verify endpoint | `src/app/api/v1/apple/verify/route.ts` |
| Apple webhook endpoint | `src/app/api/v1/webhooks/apple/route.ts` |
| Mobile auth endpoint | `src/app/api/v1/auth/verify-id-token/route.ts` |
| Backend config | `src/lib/api/config.ts` |
| Apple subscription apply | `src/lib/api/apple-subscription-apply.ts` |
| Subscription reconciliation | `src/lib/api/subscription-reconciliation.ts` |
| User model | `src/models/user.ts` |
| API middleware | `src/lib/api/middleware.ts` |
| Mobile documentation | `docs/MOBILE_EXPO_BILLING.md` |

---

## Confirmed Root Causes (Backend)

### RC-1: `APPLE_APP_STORE_ENVIRONMENT` Set to Sandbox in Production

**Description**

The `getAppleEnvironment()` function in the Apple IAP service defaults to `sandbox` when the environment variable is absent or unrecognized. The `.env` file in the repository also contains `APPLE_APP_STORE_ENVIRONMENT=sandbox`. This means the `SignedDataVerifier` and `AppStoreServerAPIClient` are both initialised for the Sandbox environment on the production server.

Apple signs live App Store transactions with Production CA certificates. When the Sandbox `SignedDataVerifier` attempts to verify a Production JWS token, cryptographic verification fails unconditionally. The error propagates up through `resolveAppleSubscription` and is caught by the catch block in `POST /api/v1/apple/verify`, which returns `HTTP 400 VerificationFailed`. The same failure occurs in the webhook handler, which returns `HTTP 500 ServerError`.

**Evidence**

```
src/services/apple-app-store.service.ts  line 35–38
src/lib/api/config.ts                    line 150
```

```typescript
// src/services/apple-app-store.service.ts:35-38
function getAppleEnvironment(): Environment {
  const raw = (config.APPLE_APP_STORE_ENVIRONMENT || 'sandbox').toLowerCase();
  return raw === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;
}
```

```typescript
// src/lib/api/config.ts:150
APPLE_APP_STORE_ENVIRONMENT: process.env.APPLE_APP_STORE_ENVIRONMENT || 'sandbox',
```

**Impact**

- **100% of live App Store purchases fail** with `VerificationFailed` (HTTP 400).
- Subscription is never written to the database.
- Student's Apple account is charged; app access is never unlocked.
- Webhook renewals also fail (JWS from Production CA rejected by Sandbox verifier).

**Backend fix required**

Set `APPLE_APP_STORE_ENVIRONMENT=production` in the production environment. See [Backend Fix Instructions → Step 1](#step-1-set-apple_app_store_environmentproduction).

---

### RC-2: Only Monthly Product ID Accepted — Annual/Quarterly Plans Blocked

**Description**

The verify route applies a hard product ID filter before calling Apple's API. Only `APPLE_PRO_MONTHLY_PRODUCT_ID` passes. Any other product ID — including annual or quarterly plans — returns HTTP 400 `ValidationError` immediately. The same guard is also present inside `resolveAppleSubscription` (line 194), so even if the route-level check is bypassed it still fails.

**Evidence**

```
src/app/api/v1/apple/verify/route.ts          line 52–60
src/services/apple-app-store.service.ts       line 165, 194–196, 222–224
src/lib/api/config.ts                         line 148
```

```typescript
// src/app/api/v1/apple/verify/route.ts:52-60
if (
  body.productId &&
  body.productId !== config.APPLE_PRO_MONTHLY_PRODUCT_ID
) {
  return NextResponse.json(
    { code: 'ValidationError', message: 'Invalid product ID.' },
    { status: 400 }
  );
}
```

```typescript
// src/services/apple-app-store.service.ts:194-196
if (!productId || productId !== expectedProductId) {
  throw new Error('Product ID does not match the configured Pro subscription.');
}
```

**Impact**

- Any annual or quarterly iOS subscription plan results in HTTP 400 before Apple's API is called.
- Student's Apple account is charged; app access is never unlocked.
- No Stripe quarterly/annual price IDs exist in `config.ts` or `.env.example`, indicating annual/quarterly plans have never been wired end-to-end.

**Backend fix required**

Replace the single-product-ID check with a set of accepted product IDs. See [Backend Fix Instructions → Step 3](#step-3-support-multiple-product-ids).

---

## Findings Requiring Mobile App Action

### F-1: `appAccountToken` Not Set or Set to Wrong Value (Email Instead of UUID)

**Description**

`appAccountToken` is a UUID v4 that the app passes to StoreKit 2 at purchase time. Apple embeds it in the transaction JWS and uses it to associate a purchase with an application-level account. The backend **never reads or writes `appAccountToken`** — it is zero-referenced across the entire codebase. This means:

1. The backend cannot use `appAccountToken` to resolve webhook events to users (race condition — see F-2 and Additional Issues).
2. The mobile app has no documented guidance on what to pass.
3. If the mobile app passes `user.email` as `appAccountToken`, Apple rejects the purchase **before the backend is called**, because Apple requires `appAccountToken` to be a valid UUID v4.

**Evidence**

```
docs/MOBILE_EXPO_BILLING.md  — no mention of appAccountToken
src/app/api/v1/auth/verify-id-token/route.ts  line 278-294  — response includes both `id` and `email`
```

The auth response shape is:
```json
{
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      ...
    },
    "token": "<session-token>"
  }
}
```

It is easy to accidentally pass `user.email` as `appAccountToken`. Apple rejects it silently at the OS level.

**Impact**

- If `appAccountToken` is set to the user's email, Apple rejects the StoreKit purchase before the backend sees anything.
- Purchase confirmation dialog may still show, but the transaction fails internally.

**Mobile app fix**

Generate a stable UUID v4 after login and use it as `appAccountToken`. Store it persistently (e.g. Keychain / SecureStore) so it survives re-installs. Do **not** use `user.id` unless you have confirmed it is a UUID v4 (see F-2).

```swift
// Swift / StoreKit 2 — correct appAccountToken usage
import StoreKit
import Foundation

func purchaseSubscription(product: Product, appUserId: UUID) async throws -> Transaction {
    // appUserId must be a UUID v4 — generate it after login and persist it
    let result = try await product.purchase(options: [
        .appAccountToken(appUserId)
    ])
    switch result {
    case .success(let verification):
        let transaction = try verification.payloadValue
        await transaction.finish()
        return transaction
    case .pending:
        throw PurchaseError.pending
    case .userCancelled:
        throw PurchaseError.cancelled
    @unknown default:
        throw PurchaseError.unknown
    }
}
```

```typescript
// React Native (Expo) — generating and persisting the account token
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values'; // required before uuid
import { v4 as uuidv4 } from 'uuid';

async function getOrCreateAppAccountToken(): Promise<string> {
  const key = 'app_account_token';
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const newToken = uuidv4();
  await SecureStore.setItemAsync(key, newToken);
  return newToken;
}
```

---

### F-2: User ID Format Mismatch — ObjectId vs UUID

**Description**

The `/api/v1/auth/verify-id-token` endpoint creates new mobile users using `new mongoose.Types.ObjectId()` (line 157 of `verify-id-token/route.ts`). This produces a 24-character hex string such as `507f1f77bcf86cd799439011`. Web users created through Better Auth's standard flow receive UUID v4 `_id` values such as `a3bb189e-8bf9-3888-9912-ace4e6543002`.

Apple requires `appAccountToken` to be a **UUID v4**. If the mobile app calls `user.id.toString()` and passes it as `appAccountToken`:

- Web users (UUID `_id`): `appAccountToken` is valid — purchase proceeds.
- Mobile-only users (ObjectId `_id`): `appAccountToken` is an invalid non-UUID string — Apple rejects the purchase at the OS level before the backend is called.

**Evidence**

```
src/app/api/v1/auth/verify-id-token/route.ts  line 157
```

```typescript
// line 157 — mobile user creation uses ObjectId, not UUID
const newUser = {
  _id: new mongoose.Types.ObjectId(),  // ← 24-char hex, NOT a UUID v4
  ...
};
```

**Impact**

- Mobile-only users (those who never signed up via web) cannot make StoreKit purchases if `user.id` is used as `appAccountToken`.
- The symptom is a silent purchase failure at the Apple/StoreKit level.

**Mobile app fix**

Do not use `user.id` as `appAccountToken` directly. Always use the separately generated and persisted UUID from F-1. You can detect the format to add a defensive assertion:

```typescript
function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isObjectId(value: string): boolean {
  return /^[0-9a-f]{24}$/i.test(value);
}

// After login:
const userId = response.data.user.id;
if (isObjectId(userId)) {
  // This user was created through the mobile auth endpoint
  // Do NOT use this as appAccountToken — use the separately generated UUID
  console.warn('User has ObjectId _id — using persisted UUID for appAccountToken');
}
const appAccountToken = await getOrCreateAppAccountToken();
```

---

### F-3: Missing `appAccountToken` Documentation

**Description**

`docs/MOBILE_EXPO_BILLING.md` — the primary reference document for the mobile team — contains no mention of `appAccountToken`, no guidance on what value to pass to StoreKit 2, and no warning about UUID format requirements.

**Impact**

- Mobile team has no basis for deciding whether to pass `user.id`, `user.email`, a separately generated UUID, or nothing.
- Likely cause of any `appAccountToken`-related purchase rejections in the field.

**Mobile app fix**

After reading this document, ensure your StoreKit purchase flow always uses a separately generated and persisted UUID v4 as `appAccountToken` (see F-1). Request the backend team to update `MOBILE_EXPO_BILLING.md` with explicit guidance. See [Backend Fix Instructions → Step 5](#step-5-add-appaccounttoken-to-webhook-user-resolution) for the backend changes that would make `appAccountToken` useful for webhook resolution.

---

## Additional Backend Issues Found

| # | Issue | File | Line(s) | Severity | Description |
|---|---|---|---|---|---|
| A-1 | `APPLE_APP_APPLE_ID` missing from `isAppleIapConfigured()` | `src/services/apple-app-store.service.ts` | 46–54 | HIGH | `APPLE_APP_APPLE_ID` is required by `SignedDataVerifier` in Production mode (line 89) but is not checked by `isAppleIapConfigured()`. It can be absent and the service will still report "configured", then throw at runtime during Production JWS verification. |
| A-2 | Webhook silently succeeds when user not found | `src/app/api/v1/webhooks/apple/route.ts` | 100–106, 216 | HIGH | If `appleOriginalTransactionId` is not yet linked to a user, the webhook logs a warning and returns early. The outer handler returns HTTP 200 `{ received: true }`. This is the race-condition window: Apple fires `SUBSCRIBED` before `/apple/verify` has been called and the transaction ID saved. The renewal event is silently dropped. |
| A-3 | `getAllSubscriptionStatuses` silently falls back on error | `src/services/apple-app-store.service.ts` | 209–241 | HIGH | If the App Store Server API call fails, the catch block falls back to the JWS `expiresDate`. No error is returned to the caller or the mobile app. A network error could cause expired subscriptions to appear active, or active subscriptions to appear expired, depending on timing. |
| A-4 | Apple ID token decoded without signature verification | `src/app/api/v1/auth/verify-id-token/route.ts` | 68–70 | HIGH | The `verifyAppleIdToken` function calls `jwt.decode()` (no verification) with a comment "In production, verify with Apple's public keys". Production traffic is already running through this path. Any crafted JWT with a valid-looking `sub` field can authenticate as any user. |
| A-5 | Synthetic relay email on repeat Apple sign-in | `src/app/api/v1/auth/verify-id-token/route.ts` | 78 | HIGH | When Apple omits `email` on repeat sign-ins (normal Apple behaviour), the backend fabricates `{sub}@privaterelay.appleid.com`. This is not a real Hide My Email address. If a user previously signed in with their real Apple email and then signs in again on a new device, a second account may be created with the synthetic email, splitting subscription history. |
| A-6 | Mobile users created with `insertOne` — bypasses Mongoose validators | `src/app/api/v1/auth/verify-id-token/route.ts` | 173 | MEDIUM | `usersCollection.insertOne(newUser)` bypasses Mongoose schema validation and hooks. Field normalisation, default values, and any pre-save middleware are skipped. |
| A-7 | Bearer session field guessing in `withAuth` middleware | `src/lib/api/middleware.ts` | — | MEDIUM | The middleware checks multiple field names (`sessionToken`, `id`, `token`) on the Better Auth session object. If Better Auth changes the session shape, all authenticated mobile requests silently fail with 401 and no actionable error message. |
| A-8 | `isSubscribed: false` returned with HTTP 200 on expired subscription | `src/app/api/v1/apple/verify/route.ts` | 85–93 | MEDIUM | If `resolveAppleSubscription` determines the subscription is expired, it still returns HTTP 200 with `isSubscribed: false`. This is ambiguous — the mobile app should treat this as a failure state and prompt the user to contact support, but without clear error codes it may be silently ignored. |
| A-9 | No Stripe quarterly/annual price IDs in config | `src/lib/api/config.ts` | 140–142 | MEDIUM | Only `STRIPE_PREMIUM_MONTHLY_PRICE_ID` is defined. Annual/quarterly plans have no corresponding Stripe price ID, confirming these plans are not wired end-to-end for either payment rail. |

---

## Environment Variables Checklist

| Variable | Purpose | In `isAppleIapConfigured()`? | Risk if Missing / Wrong |
|---|---|---|---|
| `APPLE_APP_STORE_ISSUER_ID` | Identifies the App Store Connect API key issuer | Yes | Service reports unconfigured; 500 errors on all IAP endpoints |
| `APPLE_APP_STORE_KEY_ID` | API key ID for App Store Connect API | Yes | Same as above |
| `APPLE_APP_STORE_PRIVATE_KEY` | P8 private key for signing App Store Server API JWTs | Yes | Same as above |
| `APPLE_BUNDLE_ID` | Must match the bundle ID in every transaction JWS | Yes | JWS verification throws; all purchases fail with 400 |
| `APPLE_PRO_MONTHLY_PRODUCT_ID` | Only accepted product ID | Yes | Service reports unconfigured; 500 errors |
| `APPLE_APP_APPLE_ID` | Numeric App ID, required by `SignedDataVerifier` in Production | **NO — gap** | `SignedDataVerifier` throws in Production; all purchases fail. Missing from the `isAppleIapConfigured()` check |
| `APPLE_APP_STORE_ENVIRONMENT` | Controls whether Sandbox or Production CA is used | No (defaults to `sandbox`) | **If absent in production: every real purchase fails with VerificationFailed** |
| `APPLE_APP_STORE_SHARED_SECRET` | Loaded in config but not referenced in service code | No | No known runtime impact (legacy field) |

---

## Mobile App Fix Instructions

### Step 1: Verify `appAccountToken` Usage

`appAccountToken` must be a UUID v4. Generate it once after login and persist it in the device keychain. Never use `user.id`, `user.email`, or any value derived from the backend user object as `appAccountToken`.

**Expo / React Native implementation:**

```bash
npx expo install expo-secure-store
npm install uuid react-native-get-random-values
```

```typescript
// src/utils/appAccountToken.ts
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const APP_ACCOUNT_TOKEN_KEY = 'eklana_app_account_token';

export async function getOrCreateAppAccountToken(): Promise<string> {
  const existing = await SecureStore.getItemAsync(APP_ACCOUNT_TOKEN_KEY);
  if (existing) return existing;
  const token = uuidv4();
  await SecureStore.setItemAsync(APP_ACCOUNT_TOKEN_KEY, token);
  return token;
}

// Clear only on explicit account deletion — not on logout
export async function clearAppAccountToken(): Promise<void> {
  await SecureStore.deleteItemAsync(APP_ACCOUNT_TOKEN_KEY);
}
```

**StoreKit 2 (Swift) — passing `appAccountToken`:**

```swift
// src/Purchases/PurchaseService.swift
import StoreKit
import Foundation

actor PurchaseService {
    func purchase(_ product: Product, appAccountToken: UUID) async throws -> Transaction {
        let result = try await product.purchase(options: [
            .appAccountToken(appAccountToken)
        ])

        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                throw PurchaseError.unverified
            }
            await transaction.finish()
            return transaction
        case .pending:
            throw PurchaseError.pending
        case .userCancelled:
            throw PurchaseError.cancelled
        @unknown default:
            throw PurchaseError.unknown
        }
    }
}

// Caller
let appAccountToken = UUID(uuidString: await AppAccountToken.getOrCreate())!
let transaction = try await PurchaseService().purchase(product, appAccountToken: appAccountToken)
let jwsString = transaction.jwsRepresentation // send this to backend
```

---

### Step 2: Handle ObjectId vs UUID User IDs

Until the backend is updated to create mobile users with UUID `_id` values, the mobile app must not assume `user.id` is a UUID v4. Use the persisted `appAccountToken` (Step 1) instead.

```typescript
// src/utils/userId.ts

export function isUUIDv4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isObjectId(value: string): boolean {
  return /^[0-9a-f]{24}$/.test(value);
}

// After login, log a warning for debugging purposes
export function auditUserId(userId: string): void {
  if (isObjectId(userId)) {
    console.warn(
      '[Auth] User has a MongoDB ObjectId _id — this user was created via mobile auth. ' +
      'Do not use this as appAccountToken.'
    );
  } else if (isUUIDv4(userId)) {
    console.info('[Auth] User has a UUID _id — created via web/Better Auth flow.');
  } else {
    console.error('[Auth] User _id is in an unexpected format:', userId);
  }
}
```

---

### Step 3: Verify the `/api/v1/apple/verify` Response Handling

After a successful StoreKit purchase, send the JWS string to the backend immediately.

**Endpoint:** `POST /api/v1/apple/verify`  
**Auth:** Bearer `<session-token>` (from `/api/v1/auth/verify-id-token` response)  
**Request body:**

```json
{
  "signedTransactionInfo": "<JWS string from StoreKit 2 transaction.jwsRepresentation>"
}
```

**Success response (HTTP 200):**

```json
{
  "success": true,
  "isSubscribed": true,
  "subscriptionPlan": "pro",
  "subscriptionExpiresAt": "2027-07-07T00:00:00.000Z"
}
```

**Error responses:**

| HTTP Status | `code` | Meaning | Mobile action |
|---|---|---|---|
| 400 | `ValidationError` | Missing or invalid fields / wrong product ID | Show error, do not retry automatically |
| 400 | `VerificationFailed` | JWS verification failed (sandbox vs production mismatch, bad bundle ID) | Show error; report to support |
| 404 | `NotFoundError` | User not found | Re-authenticate |
| 500 | `ConfigError` | Backend IAP not configured | Show "Service unavailable", report to backend team |

**Implementation:**

```typescript
// src/api/apple.ts
import { getSessionToken } from './auth';

interface VerifyResponse {
  success: boolean;
  isSubscribed: boolean;
  subscriptionPlan: string;
  subscriptionExpiresAt: string;
}

export async function verifyApplePurchase(
  signedTransactionInfo: string
): Promise<VerifyResponse> {
  const token = await getSessionToken();

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/apple/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ signedTransactionInfo }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Apple verify failed: ${error.code} — ${error.message} (HTTP ${response.status})`
    );
  }

  const data = await response.json();

  // Guard: backend returned 200 but subscription is not active
  if (!data.isSubscribed) {
    throw new Error('Purchase verified but subscription is not active. Contact support.');
  }

  return data;
}
```

---

### Step 4: Debug Checklist

Use this checklist when a purchase fails to diagnose the root cause:

- [ ] **Environment check**: Confirm with backend team that `APPLE_APP_STORE_ENVIRONMENT=production` is set on the production server. If set to `sandbox`, all real purchases fail.
- [ ] **Product ID check**: Confirm the product ID configured in App Store Connect matches `APPLE_PRO_MONTHLY_PRODUCT_ID` on the server. Annual/quarterly plans require backend changes.
- [ ] **`appAccountToken` format**: Log the value being passed to StoreKit. Confirm it is a UUID v4 (format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`). Not an ObjectId, not an email address.
- [ ] **User ID format**: Log `user.id` from the auth response. If it is 24 hex characters, it is an ObjectId — do not use it as `appAccountToken`.
- [ ] **Session token**: Confirm the `Authorization: Bearer <token>` header is present on `POST /api/v1/apple/verify`. A missing or expired token returns HTTP 401.
- [ ] **JWS string**: Confirm `transaction.jwsRepresentation` is non-empty and is being sent in the `signedTransactionInfo` field of the request body.
- [ ] **Bundle ID**: Confirm the bundle ID in the Xcode target matches `APPLE_BUNDLE_ID` on the server. A mismatch causes JWS verification to throw.
- [ ] **Sandbox testing**: In sandbox, `APPLE_APP_STORE_ENVIRONMENT` must be `sandbox` on the server. Do not test sandbox purchases against a production-configured server.
- [ ] **Webhook race condition**: After purchase, call `POST /api/v1/apple/verify` immediately — do not rely on the Apple webhook alone to activate the subscription.

---

## Backend Fix Instructions

### Step 1: Set `APPLE_APP_STORE_ENVIRONMENT=production`

**File:** `.env` (production deployment environment)  
**Change:** Set the variable to `production` in the production environment secrets manager (not in the `.env` file committed to the repository).

```bash
# Production .env / secrets manager
APPLE_APP_STORE_ENVIRONMENT=production
```

The default in `config.ts` (line 150) falls back to `sandbox`. Remove the default fallback so an absent variable causes an explicit error rather than silent sandbox mode:

**File:** `src/lib/api/config.ts`, line 150  
**Before:**
```typescript
APPLE_APP_STORE_ENVIRONMENT: process.env.APPLE_APP_STORE_ENVIRONMENT || 'sandbox',
```
**After:**
```typescript
APPLE_APP_STORE_ENVIRONMENT: process.env.APPLE_APP_STORE_ENVIRONMENT,
```

**File:** `src/services/apple-app-store.service.ts`, lines 35–38  
**Before:**
```typescript
function getAppleEnvironment(): Environment {
  const raw = (config.APPLE_APP_STORE_ENVIRONMENT || 'sandbox').toLowerCase();
  return raw === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;
}
```
**After:**
```typescript
function getAppleEnvironment(): Environment {
  const raw = config.APPLE_APP_STORE_ENVIRONMENT?.toLowerCase();
  if (!raw) {
    throw new Error('APPLE_APP_STORE_ENVIRONMENT is not set. Must be "production" or "sandbox".');
  }
  if (raw !== 'production' && raw !== 'sandbox') {
    throw new Error(`APPLE_APP_STORE_ENVIRONMENT has invalid value "${raw}". Must be "production" or "sandbox".`);
  }
  return raw === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;
}
```

---

### Step 2: Add `APPLE_APP_APPLE_ID` to `isAppleIapConfigured()`

**File:** `src/services/apple-app-store.service.ts`, lines 46–54  
**Before:**
```typescript
export function isAppleIapConfigured(): boolean {
  return Boolean(
    config.APPLE_APP_STORE_ISSUER_ID &&
      config.APPLE_APP_STORE_KEY_ID &&
      config.APPLE_APP_STORE_PRIVATE_KEY &&
      config.APPLE_BUNDLE_ID &&
      config.APPLE_PRO_MONTHLY_PRODUCT_ID
  );
}
```
**After:**
```typescript
export function isAppleIapConfigured(): boolean {
  const isProduction =
    config.APPLE_APP_STORE_ENVIRONMENT?.toLowerCase() === 'production';
  return Boolean(
    config.APPLE_APP_STORE_ISSUER_ID &&
      config.APPLE_APP_STORE_KEY_ID &&
      config.APPLE_APP_STORE_PRIVATE_KEY &&
      config.APPLE_BUNDLE_ID &&
      config.APPLE_PRO_MONTHLY_PRODUCT_ID &&
      config.APPLE_APP_STORE_ENVIRONMENT &&
      (!isProduction || config.APPLE_APP_APPLE_ID) // required in production
  );
}
```

---

### Step 3: Support Multiple Product IDs

**File:** `src/lib/api/config.ts`  
Add new environment variables:
```typescript
APPLE_PRO_ANNUAL_PRODUCT_ID: process.env.APPLE_PRO_ANNUAL_PRODUCT_ID,
APPLE_PRO_QUARTERLY_PRODUCT_ID: process.env.APPLE_PRO_QUARTERLY_PRODUCT_ID,
```

**File:** `src/services/apple-app-store.service.ts`  
Replace the single-product check with a set:
```typescript
function getAcceptedProductIds(): Set<string> {
  const ids = [
    config.APPLE_PRO_MONTHLY_PRODUCT_ID,
    config.APPLE_PRO_ANNUAL_PRODUCT_ID,
    config.APPLE_PRO_QUARTERLY_PRODUCT_ID,
  ].filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    throw new Error('No Apple product IDs are configured.');
  }
  return new Set(ids);
}

// In resolveAppleSubscription (line 165 area), replace:
//   const expectedProductId = config.APPLE_PRO_MONTHLY_PRODUCT_ID!;
// With:
  const acceptedProductIds = getAcceptedProductIds();

// And replace lines 194-196:
//   if (!productId || productId !== expectedProductId) { throw ... }
// With:
  if (!productId || !acceptedProductIds.has(productId)) {
    throw new Error(
      `Product ID "${productId}" is not in the configured set of accepted product IDs.`
    );
  }
```

**File:** `src/app/api/v1/apple/verify/route.ts`, lines 52–60  
Update the route-level guard:
```typescript
const acceptedProductIds = new Set([
  config.APPLE_PRO_MONTHLY_PRODUCT_ID,
  config.APPLE_PRO_ANNUAL_PRODUCT_ID,
  config.APPLE_PRO_QUARTERLY_PRODUCT_ID,
].filter(Boolean));

if (body.productId && !acceptedProductIds.has(body.productId)) {
  return NextResponse.json(
    { code: 'ValidationError', message: 'Invalid product ID.' },
    { status: 400 }
  );
}
```

---

### Step 4: Fix Synthetic Relay Email Generation

**File:** `src/app/api/v1/auth/verify-id-token/route.ts`, line 78  
**Problem:** Apple omits email on repeat sign-ins. The fabricated `{sub}@privaterelay.appleid.com` email is not a real address and causes duplicate account creation.

**Fix:** Prefer provider + `sub` for account lookup rather than email on the Apple path. If the email is absent, store a canonical placeholder and update it when Apple provides the real email.

```typescript
async function verifyAppleIdToken(idToken: string): Promise<UserInfo> {
  // TODO: Verify signature with Apple's public keys (JWKS endpoint)
  // https://appleid.apple.com/auth/keys
  const decoded = jwt.decode(idToken) as any;
  if (!decoded) throw new Error('Invalid Apple ID token');

  const sub = decoded.sub as string;

  // Apple only provides email on first sign-in.
  // Use a stable synthetic placeholder that encodes the provider, not a fake relay address.
  // Update the email field when Apple provides the real value.
  const email = decoded.email ?? null; // null signals "email not provided yet"

  return {
    email: email ?? `apple.${sub}@noemail.local`, // internal placeholder — never displayed
    name: decoded.name
      ? `${decoded.name.givenName || ''} ${decoded.name.familyName || ''}`.trim()
      : undefined,
    firstName: decoded.name?.givenName,
    lastName: decoded.name?.familyName,
    sub,
  };
}
```

Additionally, verify the Apple JWT signature rather than calling `jwt.decode()` without verification. Apple's public keys are available at `https://appleid.apple.com/auth/keys`.

---

### Step 5: Add `appAccountToken` to Webhook User Resolution

**Context:** Currently the webhook can only link a notification to a user via `appleOriginalTransactionId` (line 32 of `webhooks/apple/route.ts`). If the webhook fires before `/apple/verify` saves the transaction ID, the event is silently dropped.

**Fix:** Store `appAccountToken` on the user record during `/apple/verify`, and use it as a secondary lookup key in the webhook.

**File:** `src/models/user.ts` — add field:
```typescript
appAccountToken: { type: String, index: true, sparse: true }
```

**File:** `src/lib/api/apple-subscription-apply.ts` — save `appAccountToken` from the decoded JWS:
```typescript
// In applyAppleSubscriptionToUser, if transaction.appAccountToken is present:
if (verified.appAccountToken && !user.appAccountToken) {
  user.appAccountToken = verified.appAccountToken;
}
```

**File:** `src/app/api/v1/webhooks/apple/route.ts`, lines 31–33 — add fallback lookup:
```typescript
async function findUserByAppleOriginalTransactionId(
  originalTransactionId: string,
  appAccountToken?: string
) {
  const byTxId = await User.findOne({
    appleOriginalTransactionId: originalTransactionId,
  }).exec();
  if (byTxId) return byTxId;

  // Fallback: webhook arrived before /apple/verify saved the transaction ID
  if (appAccountToken) {
    return User.findOne({ appAccountToken }).exec();
  }
  return null;
}
```

Also update `docs/MOBILE_EXPO_BILLING.md` to document `appAccountToken` requirements.

---

## API Contract Reference

| Endpoint | Method | Auth | Request Body | Success Response | Error Responses |
|---|---|---|---|---|---|
| `/api/v1/auth/verify-id-token` | POST | None | `{ idToken: string, provider: "apple"\|"google", firstName?: string, lastName?: string }` | `200` `{ data: { user: { id, email, firstName, lastName, avatar, emailVerified }, token, session } }` | `400` missing fields; `401` invalid token; `500` Google not configured |
| `/api/v1/apple/verify` | POST | Bearer session token | `{ signedTransactionInfo?: string, transactionId?: string, originalTransactionId?: string, productId?: string }` (at least one of the first three required) | `200` `{ success: true, isSubscribed: boolean, subscriptionPlan: string, subscriptionExpiresAt: string }` | `400 ValidationError` invalid product/fields; `400 VerificationFailed` JWS failed; `404 NotFoundError` user not found; `500 ConfigError` IAP not configured |
| `/api/v1/webhooks/apple` | POST | None (Apple server) | `{ signedPayload: string }` (App Store Server Notification V2) | `200` `{ received: true }` | `400 BadRequest` missing payload; `500 ServerError` processing failed |
| `/api/v1/webhooks/apple` | GET | None | — | `200` `{ ok: true, configured: boolean }` | — |

**Important notes for mobile:**

- The Bearer token for `POST /api/v1/apple/verify` is the `data.token` (or `data.session.token`) from the `/api/v1/auth/verify-id-token` response, **not** the Apple ID token.
- Always prefer sending `signedTransactionInfo` (the raw JWS string from `transaction.jwsRepresentation`). This bypasses the product ID filter at the route level and goes directly to Apple's library for verification.
- A `200` response with `isSubscribed: false` means the purchase was verified but the subscription is expired or in a non-premium state. Treat this as a failed unlock and prompt the user.

---

## Glossary

| Term | Definition |
|---|---|
| `appAccountToken` | A UUID v4 that the mobile app passes to StoreKit 2 at purchase time via `Product.PurchaseOption.appAccountToken(_:)`. Apple embeds it in the transaction JWS, allowing the backend to link a purchase to an application-level user account without sharing PII with Apple. Must be a valid UUID v4 — any other format causes Apple to reject the purchase at the OS level. |
| `originalTransactionId` | A stable Apple-generated identifier for the original purchase in a subscription chain. All renewals share the same `originalTransactionId`. Used by the backend as the primary key for linking Apple subscriptions to user records (`user.appleOriginalTransactionId`). |
| JWS | JSON Web Signature. A compact, signed token format (header.payload.signature, Base64URL-encoded). Apple signs all transaction data and server notifications as JWS. The `@apple/app-store-server-library` `SignedDataVerifier` validates these signatures against Apple's root CA certificates. |
| `SignedDataVerifier` | The class from `@apple/app-store-server-library` responsible for verifying JWS tokens against Apple root CA certificates. Must be initialised with the correct `Environment` (`SANDBOX` or `PRODUCTION`) — a Sandbox verifier will reject Production JWS tokens and vice versa. In Production, it also requires the numeric `APPLE_APP_APPLE_ID` to validate the `appAppleId` claim in the JWS. |
| StoreKit 2 | Apple's modern in-app purchase framework (iOS 15+, Swift concurrency). Replaces the legacy receipt-based StoreKit 1. Transactions are represented as signed JWS strings accessible via `transaction.jwsRepresentation`. The backend's `/api/v1/apple/verify` endpoint is designed to accept StoreKit 2 JWS strings in the `signedTransactionInfo` field. |
