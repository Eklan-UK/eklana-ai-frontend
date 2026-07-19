# Android Stripe Mobile Contract

> **Audience:** Android / Expo team.  
> **Scope:** Android Stripe only — same API as web. **No StoreKit. No app code in this repo.**  
> **Current pricing:** [MOBILE_STRIPE_CHECKOUT_ROLLBACK.md](./MOBILE_STRIPE_CHECKOUT_ROLLBACK.md) — single monthly Pro (~US$1.99), no trial, no multi-plan.  
> **Status:** Aligned with payment rollback. Prefer the rollback doc for paywall implementation.

---

## Scope

This document is the Android contract for Pro billing via Stripe (hosted Checkout + Billing Portal).

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
| [MOBILE_STRIPE_CHECKOUT_ROLLBACK.md](./MOBILE_STRIPE_CHECKOUT_ROLLBACK.md) | **Authoritative** paywall after rollback |
| [MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md](./MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md) | **Superseded** — Challenge pricing no longer applicable |
| [docs/stripe-implementation.md](./docs/stripe-implementation.md) | Stripe endpoints, webhooks, server behavior |
| [docs/STRIPE_WEB_CHECKOUT_UI.md](./docs/STRIPE_WEB_CHECKOUT_UI.md) | Web paywall (monthly-only) |
| [docs/MOBILE_EXPO_BILLING.md](./docs/MOBILE_EXPO_BILLING.md) | Dual-rail (iOS + Android) guide — iOS / StoreKit |
| [docs/STRIPE_PAYMENTS_AND_KEYS.md](./docs/STRIPE_PAYMENTS_AND_KEYS.md) | Keys & env safety (no secrets in the app) |

---

## Locked product rules (short)

Do not change without product sign-off.

| Rule | Value |
|------|--------|
| Plan | Single **monthly** Pro |
| Price | ~**US$1.99** / month (`STRIPE_PREMIUM_MONTHLY_PRICE_ID` on server) |
| Trial | **None** — no `trial_period_days`, no trial UI |
| Checkout body | Empty / ignored — do not send `billingPeriod` |

Client never sends Stripe price IDs. Existing $20 / $60 / $200 subscribers are left on their Prices.

---

## API summary

| Step | Call |
|------|------|
| Check access | `GET /api/v1/users/current` → `user.isSubscribed` |
| Start checkout | `POST /api/v1/stripe/checkout` body `{}` (or empty) |
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
| `user.subscriptionBillingPeriod` | `"monthly" \| "quarterly" \| "annual" \| null` | Optional display when subscribed (grandfathered periods may still appear). |
| `user.subscriptionPlan` | string (e.g. `"free"` / plan id) | Display / diagnostics; not the access gate. |
| `user.subscriptionExpiresAt` | date \| null | Optional display only. |
| `user.stripeSubscriptionStatus` | string \| null | Optional diagnostics; do not gate on this. |
| `user.appleSubscriptionStatus` | string \| null | iOS diagnostics; ignore for Android gating. |

### Do not use

| Field | Why |
|-------|-----|
| `eligibleForTrial` | Removed — trial rolled back |
| `challengePricingActive` | Removed — Challenge pricing sync rolled back |

Response shape (relevant slice):

```json
{
  "user": {
    "isSubscribed": false,
    "subscriptionPlan": "free",
    "subscriptionBillingPeriod": null,
    "subscriptionActivatedAt": null,
    "subscriptionExpiresAt": null,
    "stripeSubscriptionStatus": null
  }
}
```

---

## Checkout — `POST /api/v1/stripe/checkout`

Creates a Stripe Checkout Session (`mode: subscription`). Returns a hosted URL.

### Request

```http
POST /api/v1/stripe/checkout
Authorization: Bearer <sessionToken>
Content-Type: application/json

{}
```

Body is optional. Legacy `billingPeriod` is ignored. Server always uses `STRIPE_PREMIUM_MONTHLY_PRICE_ID` (~US$1.99).

### Success response — **200**

```json
{ "url": "https://checkout.stripe.com/c/pay/cs_..." }
```

Open `url` with `WebBrowser.openBrowserAsync` / Chrome Custom Tabs / `Linking.openURL`.

### Other errors

| Status | `code` | When |
|--------|--------|------|
| 404 | `NotFoundError` | User not found |
| 500 | `ConfigError` | Stripe or monthly price ID not configured |
| 500 | `ServerError` | Checkout session creation failed |

### What the server does (do not reimplement)

1. Resolves monthly Price from `STRIPE_PREMIUM_MONTHLY_PRICE_ID`.
2. Creates/reuses Stripe Customer; persists `stripeCustomerId`.
3. Does **not** attach a trial.
4. Sets web return URLs from `NEXT_PUBLIC_APP_URL` (see [Deep links](#deep-links--return-urls)).

---

## Paywall UI expectations

Align with web ([docs/STRIPE_WEB_CHECKOUT_UI.md](./docs/STRIPE_WEB_CHECKOUT_UI.md)):

1. Single Pro offer: **US$1.99 / month**.
2. CTA: **"Upgrade to Pro"** (or **"Subscribe"**) — no trial copy.
3. On CTA: `POST /api/v1/stripe/checkout` with empty body → open `{ url }`.
4. Gate Pro with `user.isSubscribed` only after refresh/poll — never invent local entitlement.
5. Do **not** show three-plan picker, trial banner, or Challenge vs Maintainer pricing.

---

## Android TypeScript example

Checkout + browser + poll (same pattern as web: **2 s × 5** attempts ≈ 10 s):

```typescript
import * as WebBrowser from 'expo-web-browser';

async function startAndroidCheckout(apiBase: string, sessionToken: string) {
  const res = await fetch(`${apiBase}/api/v1/stripe/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Checkout failed');
  }

  const { url } = await res.json();
  if (!url) throw new Error('No redirect URL returned');

  await WebBrowser.openBrowserAsync(url);

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

**Android implication:** After Checkout, the user may land in a web page, not the app. Coordinate mobile deep links with backend/env if you need in-app return (same caveat as [docs/MOBILE_EXPO_BILLING.md](./docs/MOBILE_EXPO_BILLING.md)).

Until deep links exist: on app **foreground** after browser close, start the **2 s × 5** poll of `/users/current`. If still not subscribed after 5 attempts, show: payment confirmed; access should appear shortly — refresh / retry.

---

## Android must-not

| Do not | Why |
|--------|-----|
| Integrate **Play Billing** / Google Play IAP for this Pro SKU | Product decision: Android = Stripe rail only |
| Call `POST /api/v1/apple/verify` on Android | Apple rail is iOS-only |
| Open Stripe Checkout / Portal on **iOS** for Pro | iOS must use StoreKit |
| Send Stripe **price IDs** from the client | Server uses env monthly Price only |
| Invent local `isSubscribed` or local trial | Server entitlement only; trial removed |
| Show multi-plan or Challenge pricing UI | Rolled back |
| Embed `STRIPE_SECRET_KEY` or other secrets in the app | Public API host + auth credentials only |

---

## Confirmation checklist (Android team)

- [ ] App uses `GET /api/v1/users/current` → `isSubscribed` as the only Pro gate
- [ ] Paywall shows single monthly Pro (~US$1.99); no three-plan picker
- [ ] No trial badge / CTA; ignore any leftover `eligibleForTrial` if present in old builds
- [ ] `POST /api/v1/stripe/checkout` with empty body → open `{ url }` via WebBrowser / Custom Tabs
- [ ] After checkout return / foreground: poll `/users/current` **2 s × 5** until `isSubscribed`
- [ ] On HTTP **402** `SubscriptionRequired`, navigate to paywall / subscriptions (no local entitlement invent)
- [ ] Manage flow: `POST /api/v1/stripe/portal` → open URL; handle **400** when no Stripe customer
- [ ] No Play Billing for Pro; no Apple verify on Android; no Stripe Checkout on iOS
- [ ] Deep-link / return-URL strategy agreed with backend (or foreground-poll workaround documented)
