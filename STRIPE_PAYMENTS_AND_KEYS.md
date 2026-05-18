# Stripe Payments & API Keys Guide

## 1. Goals

- Use Stripe as the **single source of truth** for payment and subscription state.
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
  user.stripeCustomerId      = "cus_..."      ← to be added
  user.stripeSubscriptionId  = "sub_..."      ← to be added
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

**Planned webhook route:** `POST /api/v1/webhooks/stripe`

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

Add these to `.env.local` (development) and to your hosting provider's secret store (production). **Never commit them to git.**

```bash
# ── Server-only (never expose to client) ─────────────────────────────────────

# Stripe secret key — use a Restricted API Key in production (see §6).
# Prefix: sk_test_ (test mode) or sk_live_ (live mode)
STRIPE_SECRET_KEY=sk_test_...

# Webhook signing secret — obtained from the Stripe Dashboard webhook endpoint
# or from `stripe listen` output during local development.
# One secret per registered endpoint and per mode (test/live).
STRIPE_WEBHOOK_SECRET=whsec_...

# Price ID for the premium subscription (from Stripe Dashboard → Products).
# Use a test-mode Price ID while in development.
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...

# Optional: annual Price ID if you offer it
# STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_...


# ── Client-safe (safe to expose in browser / mobile bundle) ──────────────────

# Only needed if you add Stripe.js / Payment Element later.
# Not required for the Checkout Session redirect flow.
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Which key does what?

| Variable | Prefix | Where it goes | Who needs it |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_` / `sk_live_` | Server env only | Backend API routes |
| `STRIPE_WEBHOOK_SECRET` | `whsec_` | Server env only | Webhook route |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` | `price_` | Server env only | Checkout Session creation |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_` / `pk_live_` | Client bundle | Only if using Stripe.js |

---

## 6. How to Provide Keys Safely

### For local development

1. Copy `.env.local.example` (or create `.env.local` if it does not exist).
2. Paste the **test-mode** keys only (`sk_test_`, `pk_test_`).
3. Verify `.env.local` is in `.gitignore` (it already is in this project).

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

`POST /api/v1/admin/users/subscription` ([source](../src/app/api/v1/admin/users/subscription/route.ts)) allows admins to manually grant or revoke a premium subscription (offline payment, support grants, comps).

This endpoint **should remain** after Stripe is integrated:

- It is the correct path for offline payment flows, refund-and-reinstate scenarios, and support team overrides.
- It writes the same `subscriptionPlan` / `subscriptionExpiresAt` fields that `isUserSubscribed()` reads, so feature access works identically.

**Reconciliation rule (to implement):** if a user has both a live Stripe subscription and an admin-granted subscription, the record with the later `subscriptionExpiresAt` wins. Webhook handlers should only overwrite fields when the incoming Stripe state is newer than what is stored. The admin endpoint should set a `subscriptionPaymentMethod = "manual"` flag so audits can distinguish sources.

---

## 9. Future Implementation Steps

These will be separate pull requests, done after this document is reviewed:

1. **Add Stripe fields to the User model** — `stripeCustomerId` (string), `stripeSubscriptionId` (string), `stripeSubscriptionStatus` (string enum).
2. **Add webhook route** — `POST /api/v1/webhooks/stripe` with signature verification using `stripe.webhooks.constructEvent` and the `STRIPE_WEBHOOK_SECRET`. Handle the five events listed in §4.
3. **Add Checkout Session route** — `POST /api/v1/stripe/checkout` — creates or retrieves the Stripe Customer for the user, then creates a Checkout Session with `mode: 'subscription'` and the premium Price ID. Returns `{ url }` to the client.
4. **Add Billing Portal route** — `POST /api/v1/stripe/portal` — returns a portal session URL for the authenticated user's Stripe Customer.
5. **Add `requirePremium` middleware helper** — wraps `withAuth` + `isUserSubscribed` check; returns `{ code: "SubscriptionRequired", status: 402 }` if not subscribed.
6. **Apply `requirePremium` to feature routes** — starting with:
   - All routes under `/api/v1/ai/free-talk/`
   - All routes under `/api/v1/pressure-test/`
7. **Mobile app integration** — handle `402` responses to show the upgrade paywall; open the Checkout Session URL in `SFSafariViewController` (iOS) / `CustomTabsIntent` (Android) / `expo-web-browser`.
8. **Optional: Billing Portal link in profile** — `POST /api/v1/stripe/portal` → open returned URL.
9. **Go-live checklist** — review [Stripe's go-live checklist](https://docs.stripe.com/get-started/checklist/go-live), swap env vars to live-mode values, re-register webhook endpoint in live Dashboard, smoke-test with a real card.
