# iOS Payment Fix — Mobile App Action Items

Backend iOS payment fixes are complete and deployed; the items below are the **only** client-side changes required for App Store purchases to work end-to-end.

---

## TL;DR

- Every StoreKit purchase must set an `appAccountToken` — a **UUID v4**. Never use `user.id` (may be a MongoDB ObjectId, not a valid UUID) or `user.email`.
- The backend now generates and returns this UUID for you: **`user.iapAccountToken`**, included in the response from both `POST /api/v1/auth/verify-id-token` and `GET /api/v1/users/current`.
- Pass `user.iapAccountToken` to StoreKit 2's `.appAccountToken(_:)` purchase option.
- Always send `signedTransactionInfo` (the StoreKit 2 JWS) to `POST /api/v1/apple/verify` after purchase/restore — not just `transactionId`/`productId`.
- No mobile changes needed for the sandbox/production environment fix or the webhook race-condition fix — those are transparent backend fixes.

---

## Required change #1: Use `iapAccountToken` as `appAccountToken`

**Why:** Apple requires `appAccountToken` to be a UUID v4. A large share of accounts have a MongoDB ObjectId `_id` (24-char hex), which is not a valid UUID — StoreKit will reject or silently drop it.

**Where to get it:** `user.iapAccountToken`, returned by:
- `POST /api/v1/auth/verify-id-token` → `data.user.iapAccountToken`
- `GET /api/v1/users/current` → `user.iapAccountToken`

It's server-generated and guaranteed to be present (backfilled lazily on first fetch if a user predates this field).

**Minimal example (StoreKit 2 / Swift):**

```swift
try await product.purchase(
    options: [.appAccountToken(UUID(uuidString: user.iapAccountToken)!)]
)
```

Use the equivalent option in your RN/Expo IAP library (e.g. `react-native-iap`'s `appAccountToken` purchase param) if you're not calling native StoreKit directly.

> ⚠️ Never fall back to `user.id` or `user.email` for `appAccountToken`.

---

## Required change #2: Confirm purchase flow sends `signedTransactionInfo`

`POST /api/v1/apple/verify` — quick self-check (full contract already in [`docs/MOBILE_EXPO_BILLING.md`](./docs/MOBILE_EXPO_BILLING.md#post-apiv1appleverify-ios-only)):

**Request** (at least one of these three):

```json
{
  "transactionId": "2000000123456789",
  "originalTransactionId": "2000000123456789",
  "productId": "com.eklan.ai.pro.monthly",
  "signedTransactionInfo": "<StoreKit 2 JWS — send this whenever available>"
}
```

**Success (200):** `{ "success": true, "isSubscribed": true, "subscriptionPlan": "premium", "subscriptionExpiresAt": "..." }`

**Errors:**

| Status | `code` | Meaning |
|--------|--------|---------|
| 400 | `ValidationError` | Missing/invalid body or `productId` |
| 400 | `VerificationFailed` | Apple validation failed |
| 500 | `ConfigError` | Apple IAP not configured on server |

---

## Nothing required — informational only

These backend fixes are transparent to mobile; no client code needed:

- Sandbox/production environment enforcement (server rejects misconfigured env instead of silently defaulting to sandbox).
- Apple ID token JWKS verification on Sign in with Apple.
- Webhook fallback lookup by `appAccountToken` for the race condition where a renewal webhook fires before `/apple/verify` runs.
- Synthetic placeholder email fix for Apple accounts that don't share an email.

---

## Testing checklist

- [ ] `user.iapAccountToken` appears in login (`/auth/verify-id-token`) and profile (`/users/current`) responses, and is a valid UUID v4.
- [ ] StoreKit purchase call includes `.appAccountToken` set to that UUID.
- [ ] `signedTransactionInfo` is sent to `/apple/verify` after purchase and after restore.
- [ ] A full sandbox purchase round-trip returns `isSubscribed: true` from `/apple/verify`, and `GET /api/v1/users/current` reflects it.

---

## Still pending from backend/ops (blocking, not mobile's responsibility)

- App Store Connect credentials (`.p8` private key, product ID, bundle ID, Apple App ID) are still being finalized on the backend/ops side. **IAP will not work end-to-end until those are set**, regardless of mobile-side correctness. See [`IOS_PAYMENT_AUDIT.md`](./IOS_PAYMENT_AUDIT.md) for full details and owners.

---

**More detail:** [`docs/MOBILE_EXPO_BILLING.md`](./docs/MOBILE_EXPO_BILLING.md) (full API reference, platform matrix, existing checklists) · [`IOS_PAYMENT_AUDIT.md`](./IOS_PAYMENT_AUDIT.md) (complete root-cause audit)
