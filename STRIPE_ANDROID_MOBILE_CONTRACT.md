# Android Stripe Mobile Contract

> **Audience:** Android / Expo team.  
> **Scope:** Android Stripe only — same API as web. **No StoreKit. No app code in this repo.**  
> **Parent:** [STRIPE_PRICING_UPGRADE.md](./STRIPE_PRICING_UPGRADE.md) (Phase 6)  
> **Status:** Documentation complete. Android team confirmation checklist below is external sign-off.

---

## Scope

This document is the Phase 6 contract for **Android** Pro billing via Stripe (hosted Checkout + Billing Portal).

| Platform | Payment rail | This doc |
|----------|--------------|----------|
| **Android (Expo)** | Stripe Checkout + Portal | **In scope** |
| **iOS (Expo)** | StoreKit / Apple IAP | **Out of scope** — see [docs/MOBILE_EXPO_BILLING.md](./docs/MOBILE_EXPO_BILLING.md) and [docs/APPLE_IAP_IOS_IMPLEMENTATION.md](./docs/APPLE_IAP_IOS_IMPLEMENTATION.md) |
| **Web** | Stripe | Same API; UI reference in [docs/STRIPE_WEB_CHECKOUT_UI.md](./docs/STRIPE_WEB_CHECKOUT_UI.md) |

Do not duplicate StoreKit flows here.

---

## Related docs

| Doc | Why |
|-----|-----|
| [STRIPE_PRICING_UPGRADE.md](./STRIPE_PRICING_UPGRADE.md) | Parent phased plan (Phase 6) |
| [MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md](./MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md) | Phase 10 cohort UI — Challenge (~US$1.99) vs Maintainer/public paywall |
| [docs/stripe-implementation.md](./docs/stripe-implementation.md) | Stripe endpoints, webhooks, server behavior |
| [docs/STRIPE_WEB_CHECKOUT_UI.md](./docs/STRIPE_WEB_CHECKOUT_UI.md) | Phase 5 web paywall / CTA alignment |
| [docs/MOBILE_EXPO_BILLING.md](./docs/MOBILE_EXPO_BILLING.md) | Legacy dual-rail (iOS + Android) guide — iOS / StoreKit |
| [docs/STRIPE_PAYMENTS_AND_KEYS.md](./docs/STRIPE_PAYMENTS_AND_KEYS.md) | Keys & env safety (no secrets in the app) |

---

## Locked product rules (short)

Do not change without product sign-off.

| Rule | Value |
|------|--------|
| Monthly | US$20 / month |
| Quarterly (3-month) | US$60 / 3 months |
| Annual | $200 / year |
| Trial | **14 days**, only when the user is trial-eligible |
| Who grants trial | **Server only** — Checkout adds `trial_period_days: 14` when eligible; never invent trial locally |

Client shows prices and trial copy from product rules + `eligibleForTrial`. Client never sends Stripe price IDs.

---

## API summary


| Step | Call |
|------|------|
| Check access | `GET /api/v1/users/current` → `user.isSubscribed` |
| Check trial UI | `user.eligibleForTrial` |
| Start checkout | `POST /api/v1/stripe/checkout` body `{ billingPeriod }` |
| Open payment | `Linking.openURL` / `expo-web-browser` |
| Poll | Re-fetch `/users/current` until `isSubscribed` |
| Paywall | HTTP **402** `SubscriptionRequired` |
| Manage | `POST /api/v1/stripe/portal` → open URL |

All routes require auth (Better Auth session cookie and/or `Authorization: Bearer <token>`). Unauthenticated → **401**.

Base path: `{API_HOST}/api/v1`.

---

## `GET /api/v1/users/current`

**Purpose:** Single source of truth for entitlement and paywall UI.

### Fields Android must use


| Field | Type | Use |
|-------|------|-----|
| `user.isSubscribed` | `boolean` | **Only** gate for Pro features. Do not recompute from expiry locally. |
| `user.eligibleForTrial` | `boolean` | Show **"2-week free trial"** and **"Start free trial"** CTA only when `true`. |
| `user.subscriptionBillingPeriod` | `"monthly" \| "quarterly" \| "annual" \| null` | Display current period when subscribed (if present). |
| `user.subscriptionPlan` | string (e.g. `"free"` / plan id) | Display / diagnostics; not the access gate. |
| `user.subscriptionExpiresAt` | date \| null | Optional display only. |
| `user.stripeSubscriptionStatus` | string \| null | Optional diagnostics; do not gate on this. |
| `user.appleSubscriptionStatus` | string \| null | iOS diagnostics; ignore for Android gating. |

Response shape (relevant slice):

```json
{
  "user": {
    "isSubscribed": false,
    "eligibleForTrial": true,
    "subscriptionPlan": "free",
    "subscriptionBillingPeriod": null,
    "subscriptionActivatedAt": null,
    "subscriptionExpiresAt": null,
    "stripeSubscriptionStatus": null
  }
}
```

### Trial eligibility note

- `eligibleForTrial` on this endpoint is computed server-side (`isEligibleForTrial`).
- At **checkout**, the server re-checks eligibility **and** whether the Stripe customer already has any prior subscription before attaching the 14-day trial.
- Treat UI flags as hints; **server owns the trial grant**.

---

## Checkout — `POST /api/v1/stripe/checkout`

Creates a Stripe Checkout Session (`mode: subscription`). Returns a hosted URL.

### Request

```http
POST /api/v1/stripe/checkout
Authorization: Bearer <sessionToken>
Content-Type: application/json

{ "billingPeriod": "monthly" }
```

| Body field | Type | Required | Notes |
|------------|------|----------|--------|
| `billingPeriod` | `"monthly" \| "quarterly" \| "annual"` | No | Defaults to **`monthly`** if omitted or body is empty/invalid JSON. Invalid value → **400** `{ code: "ValidationError", message: "Invalid billingPeriod." }`. |

Android must send an explicit `billingPeriod` matching the user’s picker selection.

### Success response — **200**

```json
{ "url": "https://checkout.stripe.com/c/pay/cs_..." }
```

Open `url` with `WebBrowser.openBrowserAsync` / Chrome Custom Tabs / `Linking.openURL`.

### Other errors

| Status | `code` | When |
|--------|--------|------|
| 400 | `ValidationError` | Invalid `billingPeriod` |
| 404 | `NotFoundError` | User not found |
| 500 | `ConfigError` | Stripe or price ID for period not configured |
| 500 | `ServerError` | Checkout session creation failed |

### What the server does (do not reimplement)

1. Resolves Stripe price from env for `billingPeriod` (`STRIPE_PREMIUM_*_PRICE_ID`).
2. Creates/reuses Stripe Customer; persists `stripeCustomerId`.
3. If eligible, sets `subscription_data.trial_period_days: 14`.
4. Sets web return URLs from `NEXT_PUBLIC_APP_URL` (see [Deep links](#deep-links--return-urls)).

---

## Paywall UI expectations

Align with web ([docs/STRIPE_WEB_CHECKOUT_UI.md](./docs/STRIPE_WEB_CHECKOUT_UI.md)):

1. Show **three** periods with locked prices:
   - Monthly — **US$20**
   - Quarterly — **US$60**
   - Annual — **$200**
2. Show **"2-week free trial"** only when `user.eligibleForTrial === true`.
3. Primary CTA:
   - Eligible → **"Start free trial"**
   - Not eligible → **"Subscribe"** (or equivalent non-trial wording)
4. On CTA: `POST /api/v1/stripe/checkout` with selected `billingPeriod` → open `{ url }`.
5. Gate Pro with `user.isSubscribed` only after refresh/poll — never invent local entitlement.

---

## Android TypeScript example

Checkout + browser + poll (same pattern as web: **2 s × 5** attempts ≈ 10 s):

```typescript
import * as WebBrowser from 'expo-web-browser';

async function startAndroidCheckout(
  apiBase: string,
  sessionToken: string,
  billingPeriod: 'monthly' | 'quarterly' | 'annual'
) {
  const res = await fetch(`${apiBase}/api/v1/stripe/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ billingPeriod }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Checkout failed');
  }

  const { url } = await res.json();
  if (!url) throw new Error('No redirect URL returned');

  await WebBrowser.openBrowserAsync(url);

  // After return / app foreground: poll until subscribed
  await pollUntilSubscribed(apiBase, sessionToken);
}

async function pollUntilSubscribed(apiBase: string, sessionToken: string) {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const me = await fetch(`${apiBase}/api/v1/users/current`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }).then((r) => r.json());

    if (me?.user?.isSubscribed === true) {
      // Unlock Pro UI
      return;
    }
  }
  // Payment likely succeeded; webhook may still be processing — ask user to refresh
}
```

---

## 402 paywall handling

Premium routes use `withPremium` and return:

```json
{
  "code": "SubscriptionRequired",
  "message": "A Pro subscription is required to access this feature."
}
```

**HTTP status: 402**

On `status === 402` and `code === "SubscriptionRequired"`:

1. Navigate to the paywall / subscriptions screen.
2. Do **not** invent or cache a local `isSubscribed`.
3. Re-fetch `GET /api/v1/users/current` after any successful checkout poll.

---

## Portal — `POST /api/v1/stripe/portal`

Manage / cancel via Stripe Customer Billing Portal.

```http
POST /api/v1/stripe/portal
Authorization: Bearer <sessionToken>
```

**200:** `{ "url": "https://billing.stripe.com/..." }` — open in browser.

**400** if the user has no `stripeCustomerId`:

```json
{
  "code": "BadRequest",
  "message": "No billing account found. Please subscribe first."
}
```

Only show “Manage subscription” when the user is subscribed **and** has a Stripe billing account (expect 400 otherwise — e.g. Apple-only subscribers).

---

## Deep links / return URLs

Today, Checkout and Portal return URLs are **web-oriented**, built from `NEXT_PUBLIC_APP_URL` (fallback: `NEXT_PUBLIC_API_URL`):

| Flow | Server URL today |
|------|------------------|
| Checkout success | `{appUrl}/account/settings/subscriptions?checkout=success` |
| Checkout cancel | `{appUrl}/account/settings/subscriptions` |
| Portal return | `{appUrl}/account/settings/subscriptions` |

**Android implication:** After Checkout, the user may land in a web page, not the app. Coordinate mobile deep links with backend/env if you need in-app return (same caveat as [docs/MOBILE_EXPO_BILLING.md](./docs/MOBILE_EXPO_BILLING.md)), e.g.:

- `eklan://subscription/success?checkout=success`
- Register scheme / intent filters in Expo config

Until deep links exist: on app **foreground** after browser close, start the **2 s × 5** poll of `/users/current`. If still not subscribed after 5 attempts, show: payment confirmed; access should appear shortly — refresh / retry.

---

## Android must-not

| Do not | Why |
|--------|-----|
| Integrate **Play Billing** / Google Play IAP for this Pro SKU | Product decision: Android = Stripe rail only |
| Call `POST /api/v1/apple/verify` on Android | Apple rail is iOS-only |
| Open Stripe Checkout / Portal on **iOS** for Pro | iOS must use StoreKit |
| Send Stripe **price IDs** from the client | Server maps `billingPeriod` → env price |
| Invent local `isSubscribed` or local trial | Server entitlement + Checkout trial grant only |
| Embed `STRIPE_SECRET_KEY` or other secrets in the app | Public API host + auth credentials only |

---

## Confirmation checklist (Android team)

Track human confirmation for Phase 6 exit. Leave unchecked until the mobile team signs off.

- [ ] App uses `GET /api/v1/users/current` → `isSubscribed` as the only Pro gate
- [ ] Paywall shows three periods (US$20 / US$60 / $200) and sends `billingPeriod` on checkout
- [ ] Trial badge / “Start free trial” CTA only when `eligibleForTrial === true`
- [ ] `POST /api/v1/stripe/checkout` → open `{ url }` via WebBrowser / Custom Tabs
- [ ] After checkout return / foreground: poll `/users/current` **2 s × 5** until `isSubscribed`
- [ ] On HTTP **402** `SubscriptionRequired`, navigate to paywall / subscriptions (no local entitlement invent)
- [ ] Manage flow: `POST /api/v1/stripe/portal` → open URL; handle **400** when no Stripe customer
- [ ] No Play Billing for Pro; no Apple verify on Android; no Stripe Checkout on iOS
- [ ] Deep-link / return-URL strategy agreed with backend (or foreground-poll workaround documented)

**External sign-off:** Android team confirms 402 handling + checkout flow against this contract.
