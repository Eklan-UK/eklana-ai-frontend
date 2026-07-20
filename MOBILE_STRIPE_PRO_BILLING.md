# Mobile Stripe Pro Billing (current)

> **Audience:** Android / Expo (Stripe Checkout). iOS StoreKit is out of scope.  
> **Product:** Single monthly Pro — **~US$1.99**. No trial. No multi-plan.  
> **This is the authoritative endpoint contract** for mobile. Prefer this over older pricing docs.

---

## Base URL

```
{API_HOST}/api/v1
```

Examples:

| Environment | `{API_HOST}` |
|-------------|--------------|
| Local | `http://localhost:3000` (or your machine IP for device) |
| Staging | your staging origin (same host the app uses for auth) |
| Production | your production API origin |

All billing routes below are under `/api/v1`. Use the **same host** as login / Better Auth so cookies/tokens match.

---

## Auth

Every call requires a signed-in student:

```http
Authorization: Bearer <sessionToken>
```

and/or Better Auth session cookie (web). Unauthenticated → **401**.

Do **not** put Stripe secret keys or Price IDs in the app.

---

## Endpoints (use these)

| Action | Method + path | Body | Success |
|--------|---------------|------|---------|
| Entitlement / paywall state | `GET /api/v1/users/current` | — | `{ user: { isSubscribed, … } }` |
| Start Pro checkout | `POST /api/v1/stripe/checkout` | `{}` or empty | `{ "url": "https://checkout.stripe.com/…" }` |
| Manage / cancel (Billing Portal) | `POST /api/v1/stripe/portal` | none / `{}` | `{ "url": "https://billing.stripe.com/…" }` |

Open `url` with `Linking.openURL` or `expo-web-browser`.

---

## 1. `GET /api/v1/users/current`

**Gate Pro features only with** `user.isSubscribed === true`.

| Field | Use |
|-------|-----|
| `user.isSubscribed` | **Required** — only access gate |
| `user.subscriptionPlan` | Optional display |
| `user.subscriptionExpiresAt` | Optional display |
| `user.subscriptionBillingPeriod` | Optional display if present |

### Do not use (removed / invalid)

- `eligibleForTrial`
- `challengePricingActive`
- Any client-side “next price is $20” logic

---

## 2. `POST /api/v1/stripe/checkout` — start Pro (~US$1.99)

Server always uses `STRIPE_PREMIUM_MONTHLY_PRICE_ID` (~US$1.99).  
**Body is ignored.** Do not send `billingPeriod`. Do not send Stripe Price IDs.

```http
POST /api/v1/stripe/checkout
Authorization: Bearer <sessionToken>
Content-Type: application/json

{}
```

**200**

```json
{ "url": "https://checkout.stripe.com/c/pay/cs_…" }
```

Open that URL in the browser. After return / app foreground, poll `GET /users/current` until `isSubscribed` (e.g. every 2s, up to ~5 times).

**Errors (typical)**

| Status | Meaning |
|--------|---------|
| 401 | Not authenticated |
| 404 | User not found |
| 500 | Stripe / price not configured |

There is **no** free trial (`trial_period_days` is not set).

---

## 3. `POST /api/v1/stripe/portal` — manage subscription

For already-subscribed Pro users (cancel, payment method, invoices). Opens Stripe Customer Portal.

```http
POST /api/v1/stripe/portal
Authorization: Bearer <sessionToken>
Content-Type: application/json
```

**200:** `{ "url": "https://billing.stripe.com/…" }` — open in browser.

**400:** No Stripe customer yet — user must checkout first.

Next renewal amount is controlled by Stripe (current Price / schedules). App does not set “next price” copy; Portal shows Stripe’s estimate.

---

## Paywall UI (match web)

1. One offer: **US$1.99 / month** (or “Upgrade to Pro”).
2. CTA label: **Upgrade to Pro** / **Subscribe** — no “Start free trial”.
3. No US$20 / US$60 / $200 plan picker.
4. On CTA → `POST /stripe/checkout` → open `url`.
5. On HTTP **402** `SubscriptionRequired` → show paywall (never invent local entitlement).

---

## TypeScript example

```typescript
import * as WebBrowser from 'expo-web-browser';

const apiBase = process.env.EXPO_PUBLIC_API_URL; // e.g. https://app.example.com

async function startProCheckout(sessionToken: string) {
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
    throw new Error(body?.message || `Checkout failed (${res.status})`);
  }

  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error('No checkout URL returned');

  await WebBrowser.openBrowserAsync(url);
}

async function openBillingPortal(sessionToken: string) {
  const res = await fetch(`${apiBase}/api/v1/stripe/portal`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Portal failed (${res.status})`);
  }

  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error('No portal URL returned');

  await WebBrowser.openBrowserAsync(url);
}
```

---

## Wrong / obsolete (do not implement)

| Wrong | Right |
|-------|--------|
| `POST /stripe/checkout` with `{ billingPeriod: "monthly" \| "quarterly" \| "annual" }` | Empty body `{}` |
| Three-plan UI (US$20 / US$60 / $200) | Single ~US$1.99 |
| Trial CTA / `eligibleForTrial` | No trial |
| Challenge vs Maintainer paywall | Same Pro for everyone |
| Client-selected Stripe Price IDs | Server env Price only |
| [MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md](./MOBILE_ZERO_PAUSE_STUDENT_CONTRACT.md) | Superseded for pricing |

---

## Related docs

| Doc | Role |
|-----|------|
| **This file** | **Current** mobile Stripe endpoints + paywall |
| [STRIPE_ANDROID_MOBILE_CONTRACT.md](./STRIPE_ANDROID_MOBILE_CONTRACT.md) | Longer Android notes (aligned) |
| [MOBILE_STRIPE_CHECKOUT_ROLLBACK.md](./MOBILE_STRIPE_CHECKOUT_ROLLBACK.md) | Rollback history / why multi-plan was removed |
| [docs/MOBILE_EXPO_BILLING.md](./docs/MOBILE_EXPO_BILLING.md) | Dual-rail overview (iOS StoreKit + Android) |
| [docs/APPLE_IAP_IOS_IMPLEMENTATION.md](./docs/APPLE_IAP_IOS_IMPLEMENTATION.md) | iOS only |

---

## Acceptance checklist (mobile QA)

- [ ] Upgrade calls `POST {API_HOST}/api/v1/stripe/checkout` with auth and empty/`{}` body  
- [ ] Browser opens Stripe Checkout for ~US$1.99 (not $20 / quarterly / annual)  
- [ ] After pay, `GET /users/current` → `isSubscribed: true`  
- [ ] Manage subscription calls `POST /api/v1/stripe/portal` and opens Portal  
- [ ] No trial / multi-plan / Challenge pricing UI  
- [ ] 402 responses send user to paywall  
