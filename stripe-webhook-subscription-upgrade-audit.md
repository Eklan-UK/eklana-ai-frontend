# Stripe Webhook & Subscription Upgrade Audit

**Date:** 2026-05-18  
**Scope:** Eklan web frontend (`eklana-ai-frontend`) — Stripe Checkout, webhooks, MongoDB user subscription fields, and client gating.  
**Symptom investigated:** User completed payment but remained on the free tier after several minutes.

---

## Production HTTP 404 on webhook endpoint (2026-05-14+)

**Stripe Dashboard symptom:** `POST https://app.eklan.ai/api/v1/webhooks/stripe` returns **HTTP 404** (e.g. 135 failures since 2026-05-14). Subscription upgrades never run because events never reach the handler.

### Root cause (verified 2026-05-18)

| Check | Production `app.eklan.ai` | Staging `staging.eklan.ai` | This repo |
|-------|---------------------------|----------------------------|-----------|
| `POST /api/v1/webhooks/stripe` | **404** (`x-matched-path: /404`) | **400** missing `stripe-signature` (route exists) | Route at `src/app/api/v1/webhooks/stripe/route.ts` |
| `POST /api/v1/stripe/checkout` | **404** | **401** (auth required) | Same branch as webhooks |
| Route on `origin/main` | **No** | N/A | Stripe integration not merged to `main` |
| Route on `origin/fix/webapp_cleanup_sa` | N/A | Deployed from this branch | Full Stripe stack present |

**Conclusion:** This is a **deployment / branch mismatch**, not a Next.js rewrite, middleware, or trailing-slash bug.

- `app.eklan.ai` (Vercel production) deploys **`main`**, which does **not** include Stripe API routes, `stripe` npm dependency, or `STRIPE_*` config usage.
- `staging.eklan.ai` deploys a branch that **includes** the integration (e.g. `fix/webapp_cleanup_sa`); the webhook route responds correctly.
- Middleware (`src/middleware.ts`) explicitly allows `/api/*`; `next.config.ts` has no `basePath` and no rewrite that blocks this path.
- Stripe was pointed at production on **2026-05-14** (same day as commit `9d48886` added webhooks on the feature branch), so 404s started immediately while code only existed off `main`.

**Not the cause:** Wrong URL path (path is correct), signature secret (would be 400), or `findUserByCustomer` silent no-op (would be 200).

### Remediation (operations)

1. **Merge and deploy Stripe to production**
   - Merge `fix/webapp_cleanup_sa` (or a PR containing at minimum Stripe routes, `package.json` `stripe` dep, `src/lib/api/config.ts` `STRIPE_*`, user model subscription fields, checkout/portal/webhook/admin stripe-sync) into **`main`**.
   - Trigger a **production** Vercel deploy for `app.eklan.ai` from `main`.

2. **Set production environment variables** (Vercel → Project → Production → Environment Variables)
   - `STRIPE_SECRET_KEY` (live restricted key)
   - `STRIPE_WEBHOOK_SECRET` (signing secret for the **production** webhook endpoint in Dashboard)
   - `STRIPE_PREMIUM_MONTHLY_PRICE_ID` (live price id)

3. **Verify route is live (before Stripe)**

   ```bash
   # Should return JSON { ok: true, ... } — NOT HTML 404
   `curl -sS https://app.eklan.ai/api/v1/webhooks/stripe`

   # Should return 400 JSON (missing stripe-signature) — NOT 404
   curl -sS -X POST https://app.eklan.ai/api/v1/webhooks/stripe \
     -H "Content-Type: application/json" -d '{}'
   ```

4. **Stripe Dashboard** ([Webhooks](https://dashboard.stripe.com/webhooks))
   - Endpoint URL: `https://app.eklan.ai/api/v1/webhooks/stripe`
   - Mode: **Live** (must match live API keys)
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - Copy the endpoint **Signing secret** into `STRIPE_WEBHOOK_SECRET` and redeploy if you change it.
   - Use **Send test webhook** or **Resend** on failed events after deploy succeeds.

5. **Local / CLI testing** (development)

   ```bash
   stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
   # Use the CLI-printed whsec_... as STRIPE_WEBHOOK_SECRET in .env.local
   stripe trigger checkout.session.completed
   ```

6. **Backfill users who paid during the 404 window**
   - `POST /api/v1/admin/users/stripe-sync` with `{ "email": "user@example.com" }` (requires admin auth), or
   - `npx tsx scripts/stripe-sync-user.ts --email user@example.com`

### Prevention

- After any Stripe-related merge, run the `curl` checks above on **production** before registering the webhook URL in Stripe.
- Keep **test** webhooks on `localhost` or staging; point **live** webhooks only at production after deploy verification.
- Align Vercel production branch with the branch that contains payment routes (`main` should always include them once shipped).

---

## Executive summary

### Most likely root cause: **account mismatch via `stripeCustomerId` lookup (silent webhook no-op)**

All webhook handlers resolve the platform user with a **single strategy**:

```43:46:src/app/api/v1/webhooks/stripe/route.ts
/** Find user by stripeCustomerId. */
async function findUserByCustomer(customerId: string) {
  return User.findOne({ stripeCustomerId: customerId }).exec();
}
```

If Stripe’s `customer` on the event (`checkout.session.completed`, `customer.subscription.*`, `invoice.*`) does not match the `stripeCustomerId` stored on the MongoDB user who is logged in and polling `GET /api/v1/users/current`, the handler **logs a warning and returns without updating any user**. The HTTP handler still responds **`200 { received: true }`**, so **Stripe does not retry** and the paying user stays on `subscriptionPlan: "free"` indefinitely.

This matches “paid but still free after minutes”: payment succeeded in Stripe, webhooks were likely delivered and “succeeded” from Stripe’s perspective, but **no row was updated**.

### Secondary causes (also possible)

| Cause | Effect |
|--------|--------|
| Wrong/missing `STRIPE_WEBHOOK_SECRET` or test/live key mismatch | Signature failure (`400`) or wrong environment; events never applied |
| Webhook endpoint URL or event types not registered in Dashboard | Events never reach the app |
| `checkout.session.completed` early return (no subscription id, non-subscription mode) | No upgrade; still `200` |
| User logged into a **different** platform account than the one that called `POST /api/v1/stripe/checkout` | Webhook may have upgraded another user; poller sees `free` |
| Handler exception before save | `500` → Stripe retries (usually self-heals unless persistent) |

### Recovery path that already exists

`POST /api/v1/admin/users/stripe-sync` and `scripts/stripe-sync-user.ts` can fix users by **email** or **userId** and backfill `stripeCustomerId` from Stripe’s customer list — logic the webhook **does not** use.

---

## Architecture overview

```
┌─────────────┐     POST /api/v1/stripe/checkout (withAuth)     ┌──────────────┐
│   Client    │ ────────────────────────────────────────────────► │   Next.js    │
│ (web/mobile)│ ◄──────────────────────────── { url }             │   API        │
└─────────────┘                                                   └──────┬───────┘
       │ open Stripe Checkout URL                                        │
       ▼                                                                 │ creates/reuses Customer
┌─────────────┐                                                          │ saves stripeCustomerId
│   Stripe    │                                                          ▼
│  Checkout   │                                                   ┌──────────────┐
└─────────────┘                                                   │   MongoDB    │
       │ payment success                                          │   users      │
       ▼                                                          └──────────────┘
┌─────────────┐     POST /api/v1/webhooks/stripe (unsigned)              ▲
│   Stripe    │ ─────────────────────────────────────────────────────────┘
│  Webhooks   │         findUserByCustomer(cus_*) ONLY
└─────────────┘

Client polls GET /api/v1/users/current → isUserSubscribed(user)
```

**Source of truth for feature access:** MongoDB fields on `User`, especially `subscriptionPlan`, `subscriptionExpiresAt`, and `stripeSubscriptionStatus`. Stripe is authoritative for billing; the app only upgrades when webhooks (or admin/sync) write those fields.

---

## Step-by-step webhook flow

**Route:** `POST /api/v1/webhooks/stripe`  
**File:** `src/app/api/v1/webhooks/stripe/route.ts`

### 1. Request ingress

| Step | Behavior |
|------|----------|
| Config check | Returns `500` if `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` missing |
| Signature header | Returns `400` if `stripe-signature` absent |
| Raw body | `await req.text()` — correct for App Router verification |
| Verification | `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)` |
| Verify failure | `400 Unauthorized` — Stripe will retry |

### 2. Event dispatch (`switch (event.type)`)

| Event | Handler | Updates DB? |
|-------|---------|-------------|
| `checkout.session.completed` | `handleCheckoutSessionCompleted` | Yes, if user found |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Yes, if user found |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Yes, if user found |
| `invoice.paid` | `handleInvoicePaid` | Yes, if subscription invoice & user found |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Sets `past_due` only |
| *anything else* | Log “Unhandled event type” | No |

### 3. Response semantics

| Outcome | HTTP | Stripe retries? |
|---------|------|-----------------|
| Success (including **no-op** user not found) | `200` | No |
| Signature/config client errors | `400` / `500` config | Depends |
| Uncaught exception in handler | `500` | Yes |

**Critical design gap:** “User not found for customer” is treated as success (`200`), not a retryable failure.

---

## Handler details

### `checkout.session.completed`

1. Ignore if `session.mode !== 'subscription'` or no `session.customer`.
2. Resolve `subscriptionId` from `session.subscription` or `stripe.subscriptions.list` (active/trialing/past_due).
3. If no subscription → **warn and return** (no DB write).
4. `stripe.subscriptions.retrieve` with `expand: ['items.data']` for period end (Dahlia API: period on **items**, not subscription root).
5. `findUserByCustomer(customerId)` — **only lookup**.
6. On match: set `subscriptionPlan = 'premium'`, `stripeSubscriptionId`, `stripeSubscriptionStatus`, `subscriptionActivatedAt`, `subscriptionExpiresAt`, `subscriptionPaymentMethod = 'stripe'`, `save()`.

Does **not** set `stripeCustomerId` on user (assumes checkout route already did).

### `customer.subscription.updated`

1. Re-fetch subscription with expanded items for `current_period_end`.
2. Lookup user by customer id.
3. Update `stripeSubscriptionId`, `stripeSubscriptionStatus`; extend `subscriptionExpiresAt` only if new period is later (idempotent).
4. Status mapping:
   - `active` / `trialing` → `subscriptionPlan = 'premium'`
   - `canceled` / `unpaid` / `incomplete_expired` → `free`, clear expiry
   - **`past_due`** → does not change plan (grace); does not use `isUserSubscribed`’s active shortcut unless status still `active`/`trialing`

### `customer.subscription.deleted`

Downgrade to `free`, clear subscription id, status `canceled`, clear dates.

### `invoice.paid`

1. Skip if not a subscription invoice (`invoiceIsForSubscription` checks parent type, `billing_reason`, line `subscription`).
2. Period end from **first line item** `period.end`.
3. Lookup by customer; extend expiry (monotonic); set `subscriptionPlan = 'premium'`.

### `invoice.payment_failed`

Sets `stripeSubscriptionStatus = 'past_due'` only; does not downgrade plan.

---

## User matching: fields and fallbacks

### What checkout establishes

**File:** `src/app/api/v1/stripe/checkout/route.ts`

| Field | Where set | Used by webhook? |
|-------|-----------|------------------|
| `stripeCustomerId` on User | Created via `stripe.customers.create` if missing, then `user.save()` | **Required** for webhook lookup |
| `metadata.userId` on Stripe Customer | Only when **new** customer is created | **Not read** by webhook |
| `email` / `name` on Stripe Customer | From platform user | **Not read** by webhook |
| Checkout Session `client_reference_id` | **Not set** | N/A |
| Session `metadata` | **Not set** | N/A |

```64:87:src/app/api/v1/stripe/checkout/route.ts
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
        metadata: { userId: String(user._id) },
      });
      // ...
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: config.STRIPE_PREMIUM_MONTHLY_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/account/settings/subscriptions?checkout=success`,
      cancel_url: `${appUrl}/account/settings/subscriptions`,
      allow_promotion_codes: true,
    });
```

### What webhooks use

| Stripe payload field | Platform match |
|---------------------|----------------|
| `customer` (cus_…) | `User.stripeCustomerId` **exact equality** |
| Customer `metadata.userId` | Ignored |
| Customer `email` | Ignored |
| Session `client_reference_id` | Ignored |

### What admin sync uses (contrast)

**File:** `src/app/api/v1/admin/users/stripe-sync/route.ts`

1. Find user by `userId`, `email`, or `stripeCustomerId`.
2. If no `stripeCustomerId` on user → `stripe.customers.list({ email: user.email })` and take `customers.data[0]`.
3. List subscriptions for that customer; sync if active/trialing.

**Webhook lacks steps 2–3’s fallback**, which is why sync can fix cases webhooks cannot.

---

## Account mismatch failure scenario (detailed)

### Scenario A — `stripeCustomerId` never on the paying user’s document

1. Payment completes on Stripe Customer `cus_PAY`.
2. MongoDB user who logs in has `stripeCustomerId: null` or `cus_OTHER`.
3. Webhook runs `findUserByCustomer('cus_PAY')` → `null`.
4. Log: `checkout.session.completed — user not found for customer`.
5. Response `200` → no retry; user stays `free`.

**How this happens in practice:**

- Checkout created customer but **failed to persist** `stripeCustomerId` (rare: DB error after Stripe create).
- Payment made outside app checkout (Dashboard, Payment Link, different product) — no link in MongoDB.
- **Manual Stripe customer** attached to a subscription not created through `POST /api/v1/stripe/checkout`.
- Data migration / support edited user record and cleared `stripeCustomerId`.

### Scenario B — multiple Stripe customers per email

1. User has `stripeCustomerId = cus_OLD` in MongoDB from an abandoned checkout.
2. A **new** `cus_NEW` was created in Stripe (e.g. sync/admin, another environment, or customer recreated) and **payment attached to `cus_NEW`**.
3. Checkout route **reuses** `cus_OLD` (because field is set) — normally payment and DB agree.
4. Mismatch appears if payment occurred on `cus_NEW` while DB still has `cus_OLD` (external payment, Stripe Dashboard merge, test/live confusion).

`stripe-sync` uses `customers.list({ email })` and picks `[0]` (newest by default sort) — may **fix** or **worsen** if wrong customer is first.

### Scenario C — wrong platform account (session vs payer)

1. User A is authenticated; checkout binds to User A’s Stripe customer.
2. User B is logged in when polling `/users/current` (different browser profile, shared device, mobile token mix-up).
3. Webhook correctly upgrades User A; User B still sees `free`.

Not a webhook bug; looks identical to users.

### Scenario D — test vs live mode

- Live payment → live `cus_` / `sub_`.
- App or webhook uses **test** `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` → verification or API retrieve fails, or wrong Dashboard endpoint.

---

## Events handled vs missing

### Handled (5)

| Event | Purpose in this codebase |
|-------|---------------------------|
| `checkout.session.completed` | Initial activation after Checkout |
| `customer.subscription.updated` | Renewals, cancel, status changes |
| `customer.subscription.deleted` | Final downgrade |
| `invoice.paid` | Renewal period extension |
| `invoice.payment_failed` | Mark `past_due` |

### Not handled (relevant gaps)

| Event | Risk if omitted |
|-------|-----------------|
| `customer.subscription.created` | Usually redundant with `checkout.session.completed`; if Checkout event missing/unsubscribed, subscription may exist in Stripe while user stays `free` |
| `checkout.session.async_payment_succeeded` | Delayed payment methods — user may pay after session “completed” |
| `customer.subscription.trial_will_end` | Informational only |
| `invoice.finalized` | Not needed if `invoice.paid` works |
| `payment_intent.succeeded` | Not used (Checkout + subscriptions model) |

**Dashboard checklist:** Endpoint must subscribe to at least the five handled types (see `docs/stripe-implementation.md` §16).

---

## Where subscription tier is stored and read

### MongoDB (`src/models/user.ts`)

| Field | Role |
|-------|------|
| `subscriptionPlan` | `"free"` \| `"premium"` — primary tier flag |
| `subscriptionExpiresAt` | Period end; used when Stripe status not active/trialing |
| `subscriptionActivatedAt` | First activation timestamp |
| `stripeCustomerId` | Link to Stripe Customer (**webhook key**) |
| `stripeSubscriptionId` | Active subscription id |
| `stripeSubscriptionStatus` | Mirror of Stripe status |
| `subscriptionPaymentMethod` | `"stripe"` on Stripe activation; admin may set `"manual"` |

### Access check (`src/lib/api/user-subscription.ts`)

```3:24:src/lib/api/user-subscription.ts
export function isUserSubscribed(user): boolean {
  if (!user) return false;
  if (user.subscriptionPlan !== "premium") return false;

  const stripeStatus = (user as any).stripeSubscriptionStatus;
  if (stripeStatus === "active" || stripeStatus === "trialing") return true;

  if (!user.subscriptionExpiresAt) return false;
  return expiresAt.getTime() > Date.now();
}
```

**Implications:**

- `subscriptionPlan` must be `"premium"` first.
- `active` / `trialing` → subscribed even without `subscriptionExpiresAt` (helps webhook delay on period end).
- `past_due` → **not** in the shortcut; user needs future `subscriptionExpiresAt` to retain access.
- If webhook never runs, `subscriptionPlan` stays `"free"` → **`isSubscribed` always false**.

### API exposure (`GET /api/v1/users/current`)

Computes `isSubscribed` server-side; strips admin bookkeeping fields. Does **not** expose `stripeCustomerId` to client (harder for support self-serve).

### API enforcement (`withPremium` in `src/lib/api/middleware.ts`)

Used on Free Talk, Pressure Test, and related AI routes — returns `402 SubscriptionRequired` when `isUserSubscribed` is false.

### Client UI

- `src/app/(student)/account/settings/subscriptions/page.tsx` — polls up to 5× every 2s after `?checkout=success`.
- `learnerHasProAccess` / `SubscriptionGuard` — use `isSubscribed` or `subscriptionPlan`.

---

## All failure points (checklist)

### Configuration / infrastructure

- [ ] `STRIPE_WEBHOOK_SECRET` missing or wrong endpoint secret (test CLI vs Dashboard production).
- [ ] `STRIPE_SECRET_KEY` test/live mismatch with payment mode.
- [ ] Webhook URL not `https://<host>/api/v1/webhooks/stripe` in Stripe Dashboard.
- [ ] Required event types not enabled on the endpoint.
- [ ] Deployment env vars differ from Stripe account receiving events.

### Webhook handler logic

- [ ] **User not found for `customerId`** → silent no-op, `200` (primary bug class).
- [ ] `checkout.session.completed`: `mode !== 'subscription'`.
- [ ] `checkout.session.completed`: cannot resolve `subscriptionId`.
- [ ] `invoice.paid`: `invoiceIsForSubscription` false (API shape / non-subscription invoice).
- [ ] `invoice.paid`: missing `period.end` on first line → early return.
- [ ] `getSubscriptionPeriodEnd` null → fallback +31 days on checkout only; subscription.updated may skip expiry update if null.
- [ ] Uncaught exception → `500` (retries) — less likely after minutes if retries exhausted.

### Checkout / customer linking

- [ ] `stripeCustomerId` not saved before user pays (checkout error path).
- [ ] Reused stale `stripeCustomerId` pointing to wrong Stripe customer.
- [ ] No `client_reference_id` / session metadata for secondary lookup.
- [ ] `metadata.userId` on Customer never consumed by webhooks.

### Product / UX

- [ ] User polls wrong account session.
- [ ] Polling stops at 10s; webhook delayed >10s (user sees “activate shortly” but may still be free if webhook then fails silently).
- [ ] Admin manual subscription overwritten by later webhook downgrade (edge case).

### Access logic edge cases

- [ ] `premium` + `past_due` + expired `subscriptionExpiresAt` → `isSubscribed` false while Stripe still in grace (may be intentional).
- [ ] `premium` without expiry and without `active`/`trialing` status → not subscribed.

---

## Recommended fixes (with code references)

### P1 — Harden user resolution in webhooks (fixes silent failures)

**1. Multi-step `findUserForStripeCustomer`**

Replace `findUserByCustomer` with:

1. `User.findOne({ stripeCustomerId: customerId })`
2. Else `stripe.customers.retrieve(customerId)` → `metadata.userId` → `User.findById`
3. Else match `email` from Stripe customer to `User.findOne({ email })` (lowercase)
4. On match via 2 or 3: **persist** `user.stripeCustomerId = customerId` then proceed

This aligns webhook behavior with `stripe-sync` and uses existing `metadata.userId` from checkout.

**2. Treat “paid but no user” as alertable**

- Log at **error** with `customerId`, `event.type`, `event.id`.
- Optional: emit metric / Slack.
- Consider `500` only when Stripe customer has active subscription but no platform user (forces retry after fix) — use carefully to avoid infinite retries.

**3. Set `client_reference_id` and session metadata on Checkout**

In `src/app/api/v1/stripe/checkout/route.ts`:

```typescript
client_reference_id: String(user._id),
metadata: { userId: String(user._id) },
```

In `handleCheckoutSessionCompleted`, fallback:

```typescript
const userId = session.client_reference_id ?? session.metadata?.userId;
```

### P2 — Handle `customer.subscription.created`

Add case in webhook `switch` mirroring `handleSubscriptionUpdated` or call shared `syncSubscriptionToUser(subscription)` so activation still works if `checkout.session.completed` is missing from the endpoint config.

### P3 — Checkout session hardening

- After `customers.create`, verify `user.save()` succeeded before returning checkout URL.
- On checkout create, pass `subscription_data: { metadata: { userId: String(user._id) } }` for audit trails.

### P4 — Observability

- Log structured fields: `event.id`, `event.type`, `customerId`, `userId`, `subscriptionId`, before/after `subscriptionPlan`.
- Stripe Dashboard → Webhooks → event delivery: correlate `evt_` with app logs.
- Document runbook: `POST /api/v1/admin/users/stripe-sync` with `{ "email": "..." }`.

### P5 — Client / support

- Expose `stripeCustomerId` to admins only (admin user detail API) for support tickets.
- Extend post-checkout polling (e.g. 30–60s) or add “Refresh subscription status” button calling a user-facing sync endpoint (thin wrapper over stripe-sync logic, rate-limited).

### P6 — Idempotency (recommended by stripe-webhooks skill)

- Store processed `event.id` in MongoDB (or Redis) with TTL; skip duplicates.
- Prevents double-extension of `subscriptionExpiresAt` on Stripe retries after partial failure.

### P7 — Environment / go-live

- Separate test/live webhook endpoints and secrets.
- Verify production endpoint URL and five event types after each deploy.

---

## Prevention checklist (operations & engineering)

### Before go-live

- [ ] Production webhook: `POST https://app.eklan.ai/api/v1/webhooks/stripe` (or actual host).
- [ ] Subscribe: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- [ ] `STRIPE_WEBHOOK_SECRET` matches **that** endpoint’s signing secret (live mode).
- [ ] `STRIPE_SECRET_KEY` and `STRIPE_PREMIUM_MONTHLY_PRICE_ID` are **live** objects.
- [ ] Smoke test: test card checkout → confirm MongoDB `subscriptionPlan: premium` within seconds.
- [ ] Confirm logs show `checkout.session.completed — subscription activated` with correct `userId`.

### Per incident

- [ ] Stripe Dashboard → Customer → confirm `cus_` and active `sub_`.
- [ ] MongoDB → user by login email → compare `stripeCustomerId` to Stripe Customer id.
- [ ] Stripe Dashboard → Webhooks → find `checkout.session.completed` → delivery status and response code.
- [ ] App logs → search `user not found for customer`.
- [ ] Run `POST /api/v1/admin/users/stripe-sync` with `{ "email": "..." }` or `npx tsx scripts/stripe-sync-user.ts --email ...`.
- [ ] Confirm user is on the same account they used for checkout (session email vs Stripe receipt email).

### Code review gates (future PRs)

- [ ] Any change to checkout must keep `stripeCustomerId` persistence and user linkage.
- [ ] Webhook user lookup must not rely on a single field without fallbacks.
- [ ] Never return `200` for “subscription active in Stripe but no user updated” without an alert.
- [ ] `isUserSubscribed` changes must be reflected in `withPremium` and docs.

---

## Related files (index)

| Area | Path |
|------|------|
| Webhook | `src/app/api/v1/webhooks/stripe/route.ts` |
| Checkout | `src/app/api/v1/stripe/checkout/route.ts` |
| Portal | `src/app/api/v1/stripe/portal/route.ts` |
| Admin sync | `src/app/api/v1/admin/users/stripe-sync/route.ts` |
| Admin manual plan | `src/app/api/v1/admin/users/subscription/route.ts` |
| User model | `src/models/user.ts` |
| Subscribe check | `src/lib/api/user-subscription.ts` |
| Premium middleware | `src/lib/api/middleware.ts` (`withPremium`) |
| Current user API | `src/app/api/v1/users/current/route.ts` |
| Config | `src/lib/api/config.ts` |
| CLI sync | `scripts/stripe-sync-user.ts` |
| Subscriptions UI | `src/app/(student)/account/settings/subscriptions/page.tsx` |
| Docs | `docs/stripe-implementation.md`, `docs/STRIPE_PAYMENTS_AND_KEYS.md` |

---

## Conclusion

The integration is **structurally sound** for the happy path: authenticated checkout creates/links a Stripe Customer, saves `stripeCustomerId`, and webhooks upgrade that same customer id to `premium`. The production failure mode **“paid, still free after minutes”** is best explained by webhooks that **completed successfully in Stripe’s eyes but did not update the user document**, almost always because **`findUserByCustomer` returned null** — an account/linking mismatch — not because polling is too short.

**Immediate mitigation:** `POST /api/v1/admin/users/stripe-sync` for the affected email.  
**Durable fix:** implement multi-key user resolution in webhook handlers, set `client_reference_id` on Checkout, handle `customer.subscription.created`, and stop acknowledging unrecoverable “subscription active, user not found” events without escalation.
