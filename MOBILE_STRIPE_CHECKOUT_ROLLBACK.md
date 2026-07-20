# Mobile Stripe Checkout Rollback

> **Audience:** Android / Expo team.  
> **Hand mobile this instead for day-to-day implementation:** [MOBILE_STRIPE_PRO_BILLING.md](./MOBILE_STRIPE_PRO_BILLING.md) (authoritative endpoints).  
> **Scope:** History of the rollback to a **single monthly Pro** (~US$1.99). No multi-plan, no trial, no Challenge pricing UI.  
> **Status:** Historical / context. Prefer [MOBILE_STRIPE_PRO_BILLING.md](./MOBILE_STRIPE_PRO_BILLING.md).

---

## What changed

| Before (upgrade) | After (rollback) |
|------------------|------------------|
| Three periods: US$20 / US$60 / $200 | **One** monthly Pro (~**US$1.99**) |
| Optional 14-day free trial | **No trial** |
| `POST /stripe/checkout` with `{ billingPeriod }` | **Empty body** (or ignore `billingPeriod`) |
| `user.eligibleForTrial` / `user.challengePricingActive` | **Removed** — do not use |
| Challenge paywall override (~US$1.99) | **Gone** — everyone sees the same monthly Pro |

Existing subscribers on $20 / $60 / $200 Prices are **left as-is** (no forced migrate-back). New checkouts always use `STRIPE_PREMIUM_MONTHLY_PRICE_ID` (~US$1.99).

---

## API summary

| Step | Call |
|------|------|
| Check access | `GET /api/v1/users/current` → `user.isSubscribed` |
| Start checkout | `POST /api/v1/stripe/checkout` with **no body** (or `{}`) |
| Open payment | `Linking.openURL` / `expo-web-browser` → Checkout `url` |
| Poll | Re-fetch `/users/current` until `isSubscribed` |
| Paywall | HTTP **402** `SubscriptionRequired` |
| Manage | `POST /api/v1/stripe/portal` → open URL |

All routes require auth. Base path: `{API_HOST}/api/v1`.

---

## `GET /api/v1/users/current`

| Field | Use |
|-------|-----|
| `user.isSubscribed` | **Only** Pro gate. Do not recompute locally. |
| `user.subscriptionPlan` | Display / diagnostics |
| `user.subscriptionExpiresAt` | Optional display |
| `user.subscriptionBillingPeriod` | Optional display when present |

### Do not use

- `eligibleForTrial` — removed
- `challengePricingActive` — removed
- Multi-plan / Challenge paywall UI

---

## Checkout — `POST /api/v1/stripe/checkout`

```http
POST /api/v1/stripe/checkout
Authorization: Bearer <sessionToken>
Content-Type: application/json

{}
```

Body may be empty or omitted. Any legacy `billingPeriod` field is **ignored**. Server always creates a session on `STRIPE_PREMIUM_MONTHLY_PRICE_ID` (~US$1.99).

**200:** `{ "url": "https://checkout.stripe.com/..." }` — open in browser.

There is **no** `trial_period_days` on Checkout.

---

## Paywall UI expectations

1. Single Pro offer: **US$1.99 / month** (or “Upgrade to Pro”).
2. CTA: **"Upgrade to Pro"** / **"Subscribe"** — no trial wording.
3. On CTA: `POST /api/v1/stripe/checkout` (empty body) → open `{ url }`.
4. After return / app foreground: poll `/users/current` **2 s × 5** until `isSubscribed`.
5. On HTTP **402** `SubscriptionRequired`: navigate to paywall; never invent local entitlement.
6. Manage: `POST /api/v1/stripe/portal` → open URL (handle **400** if no Stripe customer).

---

## TypeScript example

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
  // Then poll GET /api/v1/users/current until isSubscribed
}
```

---

## Mobile must-not

| Do not | Why |
|--------|-----|
| Show three-plan picker (US$20 / US$60 / $200) | Rolled back |
| Show free trial / use `eligibleForTrial` | Trial removed |
| Show Challenge vs Maintainer pricing UI | Pricing sync removed |
| Send Stripe price IDs from the client | Server uses env Price only |
| Invent local `isSubscribed` | Server entitlement only |

---

## Related docs

| Doc | Status |
|-----|--------|
| [STRIPE_ANDROID_MOBILE_CONTRACT.md](./STRIPE_ANDROID_MOBILE_CONTRACT.md) | Updated to match this rollback |
| [MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md](./MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md) | **Superseded** for pricing — do not implement |
| [STRIPE_PRICING_UPGRADE.md](./STRIPE_PRICING_UPGRADE.md) | Historical — rolled back |
| [PRICING_AND_TRIAL_MIGRATION.md](./PRICING_AND_TRIAL_MIGRATION.md) | Historical — rolled back |
| [docs/STRIPE_WEB_CHECKOUT_UI.md](./docs/STRIPE_WEB_CHECKOUT_UI.md) | Web UI (monthly-only, no trial) |

---

## Ops (server)

1. Confirm the ~US$1.99 Price ID in Stripe Dashboard.
2. Set `STRIPE_PREMIUM_MONTHLY_PRICE_ID=<that id>` in each environment.
3. Remove unused Price / trial env vars (`LEGACY`, `QUARTERLY`, `ANNUAL`, `SUBSCRIPTION_TRIAL_LAUNCH_AT`) from deployment secrets.
