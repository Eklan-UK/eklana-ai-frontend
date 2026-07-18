# Stripe Payments & API Keys Guide

> **Current pricing (post-rollback):** Single monthly Pro (~US$1.99) via `STRIPE_PREMIUM_MONTHLY_PRICE_ID`. No free trial. No multi-plan checkout.
>
> - **Mobile / checkout contract:** [MOBILE_STRIPE_CHECKOUT_ROLLBACK.md](../MOBILE_STRIPE_CHECKOUT_ROLLBACK.md).
> - **Historical upgrade plan:** [STRIPE_PRICING_UPGRADE.md](../STRIPE_PRICING_UPGRADE.md) / [PRICING_AND_TRIAL_MIGRATION.md](../PRICING_AND_TRIAL_MIGRATION.md) (rolled back).
> - **Implemented routes:** [stripe-implementation.md](./stripe-implementation.md).

## 1. Goals

- Use Stripe as the payment rail for **Android and web** (not iOS digital subscriptions — see [APPLE_IAP_IOS_IMPLEMENTATION.md](./APPLE_IAP_IOS_IMPLEMENTATION.md)).
- Use Stripe as the **single source of truth** for payment and subscription state on those platforms; server entitlement (`subscriptionPlan`, `isSubscribed`) is shared across all clients after any rail activates premium.
- Gate premium experiences behind a Stripe-managed subscription. Initial features in scope:
  - **Eklan Free Talk** — AI conversation practice sessions
  - **Eklan Pressure Test** — timed, high-pressure speaking drills
- Additional features will be added to the gated set later without architectural changes.
- Keep **all payment logic on the backend** (Next.js API routes) so the mobile app can integrate with zero duplication — it calls the same `/api/v1/...` endpoints the web app uses.

---

## 2. How Feature Access Will Work

```
User pays via Stripe Checkout
        │
        ▼
Stripe fires a webhook event
        │
        ▼
Backend verifies signature, updates MongoDB
  user.subscriptionPlan      = "premium"
  user.subscriptionExpiresAt = <period end>
  user.stripeCustomerId      = "cus_..."
  user.stripeSubscriptionId  = "sub_..."
        │
        ▼
Any API call to a premium route
  calls isUserSubscribed(user)
        │
   yes ─┴─ no
   │         │
continue    return 402 { code: "SubscriptionRequired" }
```

**Error contract for clients (web and mobile):**

| HTTP | code | When |
|------|------|------|
| 402 | `SubscriptionRequired` | User is authenticated but not on a premium plan |
| 403 | `Forbidden` | User is not authenticated |

This means the mobile app only needs to handle `402` to show an upgrade prompt — it does not need to know anything about Stripe itself.

**Feature keys (placeholder — values to be agreed during implementation):**

| Feature | Internal key |
|---------|-------------|
| Eklan Free Talk | `eklan_free_talk` |
| Eklan Pressure Test | `eklan_pressure_test` |

For the initial launch, both keys map to the single `premium` plan. If you later sell them à-la-carte, the keys become individual Stripe Products with their own Prices.

---

## 3. Backend vs Mobile Responsibilities

| Responsibility | Backend (Next.js API) | Mobile app |
|---|---|---|
| Create Stripe Customer | ✅ On first checkout | ❌ Never |
| Create Checkout Session | ✅ `POST /api/v1/stripe/checkout` | Opens returned URL in browser / SafariView |
| Create Billing Portal session | ✅ `POST /api/v1/stripe/portal` | Opens returned URL in browser / SafariView |
| Verify webhook signatures | ✅ `POST /api/v1/webhooks/stripe` | ❌ Never |
| Store `stripeCustomerId` on user | ✅ | ❌ |
| Enforce access on feature routes | ✅ All `/api/v1/pressure-test/*`, `/api/v1/ai/free-talk/*`, etc. | ❌ Never — only reads the 402 |
| Show upgrade UI / paywall screen | Renders web paywall | Renders mobile paywall |
| Know which plan the user is on | Reads `/api/v1/users/current` → `subscriptionPlan` | Same endpoint |

**Rule:** if a piece of business logic involves a Stripe API call or a `STRIPE_SECRET_KEY`, it lives exclusively in a Next.js route handler.

---

## 4. Stripe Objects to Plan For

| Object | Notes |
|--------|-------|
| **Product** | One product per feature bundle (e.g. "Eklan Premium") — created once in Stripe Dashboard |
| **Price** | One or more Prices per Product: monthly, annual, etc. Store the Price ID(s) as env vars |
| **Customer** | Created by the backend on first checkout; `id` (`cus_...`) stored on the MongoDB User document |
| **Subscription** | Created by Stripe after Checkout; `id` (`sub_...`) stored on User; status drives access |
| **Checkout Session** | Short-lived, created server-side; URL returned to client to open |
| **Billing Portal Session** | Short-lived; URL returned to client so user can cancel, swap plan, update card |
| **Webhook Endpoint** | One endpoint per environment (test / live) registered in Stripe Dashboard |

**Webhook route (implemented):** `POST /api/v1/webhooks/stripe` — **one endpoint for all price IDs** (monthly, legacy monthly, quarterly, annual). Stripe sends events by type (`checkout.session.completed`, `invoice.paid`, etc.); the handler reads `subscription.items.data[0].price.id` from the payload to distinguish plans.

**Webhook events to handle at minimum:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription; store Stripe IDs on user |
| `customer.subscription.updated` | Sync plan, `current_period_end`, status |
| `customer.subscription.deleted` | Downgrade user to `free` |
| `invoice.paid` | Extend `subscriptionExpiresAt` on renewal |
| `invoice.payment_failed` | Optionally flag / notify user |

---

## 5. Environment Variables

Copy from [`.env.example`](../.env.example) (team template) into `.env` locally or into your hosting secret store (production). **Never commit real secrets to git.**

**Config:** vars below are exported from `src/lib/api/config.ts`. Checkout always uses the monthly Price ID.

```bash
# ── Server-only (never expose to client) ─────────────────────────────────────

# Stripe secret key — Restricted API Key recommended in production (see §6).
# Prefix: sk_test_ / rk_test_ (dev) or sk_live_ / rk_live_ (production)
STRIPE_SECRET_KEY=sk_test_...

# Webhook signing secret — one per webhook endpoint and per mode (test/live).
# Dashboard endpoint OR `whsec_` printed by `stripe listen` during local dev.
STRIPE_WEBHOOK_SECRET=whsec_...

# Price ID — always `price_...`, never `prod_...` (Stripe Dashboard → Products → Prices).
# Test vs live Price IDs must match STRIPE_SECRET_KEY mode.
# Monthly Pro (~US$1.99) — all new Checkouts use this Price.
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...

# Unused after rollback (do not set): LEGACY / QUARTERLY / ANNUAL Price IDs, SUBSCRIPTION_TRIAL_LAUNCH_AT.

# ── App URL (checkout success/cancel redirects) ──────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Client-safe (optional — not used by Checkout redirect flow today) ────────
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Set `STRIPE_PREMIUM_MONTHLY_PRICE_ID` to the Stripe Price ID for ~US$1.99 monthly. Existing $20 / $60 / $200 subscribers are left on their Prices.

### Which key does what?

| Variable | Prefix | Where it goes | Who needs it |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_` / `rk_` + `_test_` / `_live_` | Server env only | Backend API routes |
| `STRIPE_WEBHOOK_SECRET` | `whsec_` | Server env only | Webhook route (one secret per endpoint) |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` | `price_` | Server env only | Checkout (monthly ~US$1.99) |
| `NEXT_PUBLIC_APP_URL` | URL | Client + server | Checkout / portal redirect URLs |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_` / `pk_live_` | Client bundle | Only if using Stripe.js |

---

## 6. How to Provide Keys Safely

### For local development

1. Copy [`.env.example`](../.env.example) to `.env` (or merge Stripe vars into your existing `.env`).
2. Prefer **test-mode** keys (`sk_test_`, `rk_test_`) and test Price IDs — avoid live keys locally unless intentional.
3. Verify `.env` is in `.gitignore` (it already is in this project).
4. For webhook testing: `stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe` — use the CLI-printed `whsec_...` as `STRIPE_WEBHOOK_SECRET` while the listener runs.

### For giving keys to a teammate or this AI assistant

- **Do not paste a secret key into chat.** If you already have, rotate it immediately in the Stripe Dashboard → Developers → API keys → Roll key.
- Share via your team's secret manager (e.g. 1Password, Doppler, Vercel Environment Variables UI) or a one-time secret share tool.
- For a developer, grant them access to the Stripe Dashboard directly (Settings → Team) instead of copying your `sk_live_` key.
- To give this assistant the ability to make test API calls: paste only `sk_test_` keys (never live keys) into project `.env.local` — the assistant reads files via tools, never exfiltrates them.

### Restricted API Keys (recommended for production)

Rather than using the full `sk_live_` secret key, create a **Restricted API Key** (`rk_live_`) in the Stripe Dashboard that has only the permissions your backend needs:

| Permission | Why |
|---|---|
| Customers — write | Create / retrieve Stripe customers |
| Checkout Sessions — write | Create Checkout Sessions |
| Billing Portal — write | Create Portal sessions |
| Subscriptions — read | Sync subscription state from webhook events |
| Prices — read | Look up Price metadata |

This limits blast radius if the key leaks.

### Rotate a leaked key

1. Stripe Dashboard → Developers → API keys → Roll key (or delete and create a new restricted key).
2. Update the key in all deployment environments.
3. Redeploy.
4. Verify webhook delivery resumed in Dashboard → Developers → Webhooks → recent events.

### Local webhook forwarding (Stripe CLI)

During development, Stripe cannot reach `localhost`. Use the Stripe CLI to forward events:

```bash
# Install (macOS)
brew install stripe/stripe-cli/stripe

# Or via npm
npx stripe login

# Forward all events to the local webhook route
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

The CLI prints a `whsec_...` signing secret — use that value as `STRIPE_WEBHOOK_SECRET` in `.env.local` while the listener is running. It changes each session.

---

## 7. Test Mode vs Live Mode

Stripe maintains fully separate environments. **Always develop in test mode first.**

| | Test mode | Live mode |
|---|---|---|
| Key prefix | `sk_test_`, `pk_test_` | `sk_live_`, `pk_live_` |
| Webhook secret | Separate `whsec_` | Separate `whsec_` |
| Product / Price IDs | Separate — must recreate in live | Real products |
| Payments | No real money; use [test cards](https://docs.stripe.com/testing#cards) | Real money |
| Dashboard toggle | Top-left "Test mode" switch | Same |

**Practical rules:**
- Keep test-mode values in `.env.local` and CI.
- Keep live-mode values only in the production secret store (Vercel / Railway / etc.).
- Never mix modes in the same deployment — a `sk_test_` key will reject live webhooks silently.

---

## 8. Relation to the Existing Admin Subscription Endpoint

`POST /api/v1/admin/users/subscription` ([source](src/app/api/v1/admin/users/subscription/route.ts)) allows admins to manually grant or revoke a premium subscription (offline payment, support grants, comps).

This endpoint **should remain** after Stripe is integrated:

- It is the correct path for offline payment flows, refund-and-reinstate scenarios, and support team overrides.
- It writes the same `subscriptionPlan` / `subscriptionExpiresAt` fields that `isUserSubscribed()` reads, so feature access works identically.

**Reconciliation rule (to implement):** if a user has both a live Stripe subscription and an admin-granted subscription, the record with the later `subscriptionExpiresAt` wins. Webhook handlers should only overwrite fields when the incoming Stripe state is newer than what is stored. The admin endpoint should set a `subscriptionPaymentMethod = "manual"` flag so audits can distinguish sources.

---

## 9. Implementation status

See [stripe-implementation.md](./stripe-implementation.md) for route contracts and [MOBILE_STRIPE_CHECKOUT_ROLLBACK.md](../MOBILE_STRIPE_CHECKOUT_ROLLBACK.md) for the current checkout contract.

### Shipped (post-rollback)

| Item | Status |
|------|--------|
| User model Stripe fields (`stripeCustomerId`, `stripeSubscriptionId`, `stripeSubscriptionStatus`, …) | ✅ |
| Webhook route `POST /api/v1/webhooks/stripe` (signature verify, core entitlement events) | ✅ |
| Checkout `POST /api/v1/stripe/checkout` (monthly ~US$1.99 only; body ignored) | ✅ |
| Billing Portal `POST /api/v1/stripe/portal` | ✅ |
| `withPremium` middleware → HTTP 402 `SubscriptionRequired` | ✅ |
| Premium gating on Free Talk / Pressure Test routes | ✅ |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` in `config.ts` + `.env.example` | ✅ |
| `billingPeriodFromStripePriceId` (monthly + keyword fallback for grandfathered prices) | ✅ |
| Admin Stripe sync `POST /api/v1/admin/users/stripe-sync` | ✅ |
| No free trial / no multi-plan / no Zero Pause Stripe price sync | ✅ |

### Go-live checklist

Review [Stripe's go-live checklist](https://docs.stripe.com/get-started/checklist/go-live): live restricted key, live monthly Price ID (~US$1.99), live webhook endpoint + matching `STRIPE_WEBHOOK_SECRET`, smoke-test checkout, verify webhook delivery in Dashboard.
