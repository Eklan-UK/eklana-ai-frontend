# Eklan – Stripe Subscription Implementation Reference

> This document captures the complete Stripe billing integration as implemented in the Eklan web app.
> It is intended as the authoritative reference for mirroring the same subscription system in the Eklan mobile app.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Subscription Plans](#2-subscription-plans)
3. [User Data Model](#3-user-data-model)
4. [Subscription Logic (`isUserSubscribed`)](#4-subscription-logic-isusersubscribed)
5. [Environment Variables](#5-environment-variables)
6. [API Endpoints](#6-api-endpoints)
   - [POST /api/v1/stripe/checkout](#post-apiv1stripecheckout)
   - [POST /api/v1/stripe/portal](#post-apiv1stripeportal)
   - [POST /api/v1/webhooks/stripe](#post-apiv1webhooksstripe)
   - [GET /api/v1/users/current](#get-apiv1userscurrent)
   - [POST /api/v1/admin/users/stripe-sync](#post-apiv1adminuserssstripe-sync)
7. [Webhook Events Handled](#7-webhook-events-handled)
8. [Full User Flow (Sign-up → Subscription → Access)](#8-full-user-flow)
9. [Frontend: Subscriptions Screen](#9-frontend-subscriptions-screen)
10. [UI Copy and Plan Feature Lists](#10-ui-copy-and-plan-feature-lists)
11. [Subscription Gating (Feature Access)](#11-subscription-gating-feature-access)
12. [Locked UI Patterns](#12-locked-ui-patterns)
13. [Post-Checkout Success Handling](#13-post-checkout-success-handling)
14. [Billing Portal (Manage Subscription)](#14-billing-portal-manage-subscription)
15. [Admin: Manual Stripe Sync](#15-admin-manual-stripe-sync)
16. [Mobile Implementation Checklist](#16-mobile-implementation-checklist)

---

## 1. Overview

Eklan uses **Stripe Checkout** (hosted by Stripe) for payments and the **Stripe Billing Portal** for subscription management. The mobile app never handles raw card details.

The backend:
- Creates a Stripe Customer on first checkout.
- Creates a Checkout Session (subscription mode) and returns a URL.
- The user is redirected to Stripe's hosted page.
- After payment, Stripe fires webhooks which update the user record in MongoDB.
- The app reads `subscriptionPlan`, `subscriptionExpiresAt`, and `stripeSubscriptionStatus` from the database to gate features.

```
User taps "Upgrade" in app
  → POST /api/v1/stripe/checkout
    → returns { url }
  → App opens Stripe-hosted page (WebView or system browser)
    → User completes payment on Stripe
  → Stripe fires webhook → POST /api/v1/webhooks/stripe
    → Backend updates user record in MongoDB
  → App polls GET /api/v1/users/current until isSubscribed = true
  → Pro features unlocked
```

---

## 2. Subscription Plans

| Internal value | Display name | Description |
|---|---|---|
| `"free"` | Free | Default on registration. Limited access. |
| `"premium"` | Pro | Paid plan. Full access to all AI features. |

- There is only **one paid plan** (monthly, recurring).
- The Stripe Price ID is configured via environment variable `STRIPE_PREMIUM_MONTHLY_PRICE_ID`.
- The price/currency amount is not shown in the app — the Stripe-hosted Checkout page displays it.

---

## 3. User Data Model

The following fields on the `User` document (MongoDB, via Mongoose) are relevant to subscription:

```
// Core subscription state
subscriptionPlan           String   "free" | "premium"   default: "free"
subscriptionActivatedAt    Date     null until first payment
subscriptionExpiresAt      Date     null until first payment; set to current period end

// Stripe identifiers
stripeCustomerId           String   Stripe Customer ID (cus_...)
stripeSubscriptionId       String   Stripe Subscription ID (sub_...)
stripeSubscriptionStatus   String   Mirrors Stripe status: "active" | "trialing" | "past_due" | "canceled" | "incomplete_expired" | "unpaid"

// Admin bookkeeping (not sent to client)
subscriptionMonthsPaidFor  Number
subscriptionAmountPaid     Number
subscriptionPaymentMethod  String   "stripe" when paid via Stripe
subscriptionAdminNote      String
subscriptionUpdatedBy      ObjectId
```

### What the client receives from `GET /api/v1/users/current`

```json
{
  "user": {
    "subscriptionPlan": "free" | "premium",
    "subscriptionActivatedAt": "<ISO date> | null",
    "subscriptionExpiresAt": "<ISO date> | null",
    "stripeSubscriptionStatus": "active" | "trialing" | "past_due" | "canceled" | null,
    "isSubscribed": true | false
  }
}
```

Admin-only fields (`subscriptionMonthsPaidFor`, `subscriptionAmountPaid`, `subscriptionPaymentMethod`, `subscriptionAdminNote`, `subscriptionUpdatedBy`) are **stripped** before sending to the client.

---

## 4. Subscription Logic (`isUserSubscribed`)

The single source of truth for "is this user subscribed" lives in `src/lib/api/user-subscription.ts`:

```typescript
export function isUserSubscribed(user): boolean {
  if (!user) return false;
  if (user.subscriptionPlan !== "premium") return false;

  // Trust Stripe's live status if available (handles webhook delays)
  const stripeStatus = user.stripeSubscriptionStatus;
  if (stripeStatus === "active" || stripeStatus === "trialing") return true;

  // Fallback: check our stored expiry date
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}
```

**Rule summary:**
1. `subscriptionPlan` must be `"premium"`.
2. If `stripeSubscriptionStatus` is `"active"` or `"trialing"` → subscribed (even if `subscriptionExpiresAt` is not yet set).
3. Otherwise, `subscriptionExpiresAt` must be in the future.

The API endpoint `GET /api/v1/users/current` runs this function and adds `isSubscribed: true/false` to the response so the client does not need to reimplement the logic.

**Mobile recommendation:** Call `GET /api/v1/users/current` and use `user.isSubscribed` directly. Do not re-evaluate expiry dates or statuses on the client.

---

## 5. Environment Variables

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret API key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for webhook verification (`whsec_...`) |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` | Stripe Price ID for the monthly Pro plan (`price_...`) |
| `NEXT_PUBLIC_APP_URL` | Base URL of the web app (used for success/cancel redirect URLs) |

The mobile backend uses the same `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PREMIUM_MONTHLY_PRICE_ID`. The `success_url` and `cancel_url` in checkout must be updated to point to the mobile app's deep link or backend return URL.

---

## 6. API Endpoints

### POST /api/v1/stripe/checkout

**Purpose:** Start a subscription checkout.

**Auth:** Required (session cookie / Bearer token).

**Request body:** None.

**Response (200):**
```json
{ "url": "https://checkout.stripe.com/pay/cs_..." }
```

**What the backend does:**
1. Fetches the authenticated user from MongoDB.
2. If the user has no `stripeCustomerId`, creates a Stripe Customer with their `email` and `name`, then saves the ID.
3. Creates a Stripe Checkout Session in `subscription` mode with:
   - The configured `STRIPE_PREMIUM_MONTHLY_PRICE_ID` (quantity 1).
   - `success_url` → `{APP_URL}/account/settings/subscriptions?checkout=success`
   - `cancel_url` → `{APP_URL}/account/settings/subscriptions`
   - `allow_promotion_codes: true`
4. Returns `{ url }` — the client opens this URL.

**Mobile:** Open the returned URL in an in-app browser or the system browser. After payment, Stripe redirects to `success_url`. The app must detect this return (via deep link or URL scheme) and then poll for `isSubscribed`.

---

### POST /api/v1/stripe/portal

**Purpose:** Open the Stripe Billing Portal so the user can cancel, change payment method, or view invoices.

**Auth:** Required.

**Request body:** None.

**Response (200):**
```json
{ "url": "https://billing.stripe.com/session/..." }
```

**What the backend does:**
1. Fetches the user's `stripeCustomerId`.
2. Creates a Billing Portal session with `return_url` → `{APP_URL}/account/settings/subscriptions`.
3. Returns `{ url }`.

**Error case (400):** User has no `stripeCustomerId` ("No billing account found. Please subscribe first.").

**Mobile:** Only show "Manage subscription" to users who are already subscribed. Open in browser.

---

### POST /api/v1/webhooks/stripe

**Purpose:** Receive signed Stripe events; update the MongoDB user record.

**Auth:** None from user. Verified via `stripe-signature` header + `STRIPE_WEBHOOK_SECRET`.

**Request body:** Raw text (Stripe event payload). Must not be pre-parsed as JSON.

**Response (200):** `{ "received": true }` on success.
**Response (400):** Signature verification failed or missing.
**Response (500):** Processing error — Stripe will retry.

See [Section 7](#7-webhook-events-handled) for events.

---

### GET /api/v1/users/current

**Purpose:** Fetch the authenticated user's profile including subscription state.

**Auth:** Required.

**Response (200):**
```json
{
  "user": {
    "_id": "...",
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "role": "user",
    "subscriptionPlan": "free | premium",
    "subscriptionActivatedAt": "ISO date | null",
    "subscriptionExpiresAt": "ISO date | null",
    "stripeSubscriptionStatus": "active | trialing | past_due | canceled | null",
    "isSubscribed": true | false,
    "hasProfile": true | false,
    ...
  }
}
```

`isSubscribed` is computed server-side by `isUserSubscribed()`. The mobile app should use this field for all gating decisions.

---

### POST /api/v1/admin/users/stripe-sync

**Purpose:** Admin-only. Manually sync a user's Stripe subscription from Stripe's API into the database (recovery tool when webhooks are missed).

**Auth:** Admin role required.

**Request body (one of):**
```json
{ "email": "user@example.com" }
{ "userId": "<mongoId>" }
{ "stripeCustomerId": "cus_..." }
```

**Response (200):** Subscription synced successfully.
**Response (422):** No active subscription found on Stripe.

---

## 7. Webhook Events Handled

| Stripe Event | What the backend does |
|---|---|
| `checkout.session.completed` | Sets `subscriptionPlan = "premium"`, records `stripeSubscriptionId`, `stripeSubscriptionStatus`, `subscriptionActivatedAt`, `subscriptionExpiresAt` (current period end), `subscriptionPaymentMethod = "stripe"` |
| `customer.subscription.updated` | Updates `stripeSubscriptionStatus` and `subscriptionExpiresAt`. If status becomes `canceled`, `unpaid`, or `incomplete_expired` → downgrades to `"free"` |
| `customer.subscription.deleted` | Sets `subscriptionPlan = "free"`, clears `stripeSubscriptionId`, sets `stripeSubscriptionStatus = "canceled"`, clears expiry and activation dates |
| `invoice.paid` | Extends `subscriptionExpiresAt` to the new period end (idempotent — only advances, never moves back) |
| `invoice.payment_failed` | Sets `stripeSubscriptionStatus = "past_due"` (user keeps access during grace period) |

**Note on `past_due`:** When a payment fails, `stripeSubscriptionStatus` is set to `"past_due"` but `subscriptionPlan` stays `"premium"`. The `isUserSubscribed()` function does **not** treat `past_due` as active via the `stripeStatus` shortcut, but if `subscriptionExpiresAt` is still in the future the user keeps access. When Stripe eventually cancels the subscription, `customer.subscription.updated` or `customer.subscription.deleted` fires and the plan is downgraded.

---

## 8. Full User Flow

### 8a. Sign-up

1. User registers via Better Auth (email + password or OAuth).
2. A `databaseHooks.user.create.after` callback runs immediately after insert and explicitly sets:
   ```
   subscriptionPlan = "free"
   subscriptionActivatedAt = null
   subscriptionExpiresAt = null
   stripeSubscriptionStatus = null
   stripeSubscriptionId = null
   ```
   (Better Auth's MongoDB adapter bypasses Mongoose schema defaults, so this patch is necessary.)
3. User goes through onboarding (name → user type → learning goals → language → nationality).
4. After onboarding, `hasProfile = true` is saved and the user lands on the home dashboard.
5. Onboarding routes are **not** gated by subscription.

### 8b. Home screen (free user)

- Assigned drills are visible but **locked** (action button shows "Pro" and morphs to "Click me" on hover/tap).
- "View Sessions" button is visible but locked.
- Practice (Free Talk, Pressure Test) cards are visible but locked.
- My Plan page (`/account/drills`) is accessible for free users — rows show a compact locked "Click me" instead of a navigate-on-tap row.
- Navigating to any Pro-only route → `SubscriptionGuard` redirects to `/account/settings/subscriptions`.

### 8c. Subscription screen

1. User is shown a two-column card: **Free** (current) vs **Pro** (with feature list and upgrade button).
2. User taps **"Upgrade to Pro"**.
3. App calls `POST /api/v1/stripe/checkout` → receives `{ url }`.
4. App opens the Stripe-hosted page (system browser or in-app browser/WebView).
5. User enters card details and confirms on Stripe.
6. Stripe redirects to `success_url`: `{APP_URL}/account/settings/subscriptions?checkout=success`.

### 8d. Post-checkout

1. App detects `?checkout=success` in the URL (deep link or URL monitoring).
2. App strips the query param and starts **polling** `GET /api/v1/users/current` every 2 seconds.
3. Meanwhile, Stripe fires `checkout.session.completed` webhook → backend upgrades the user in MongoDB.
4. Within 1–10 seconds, polling returns `isSubscribed: true`.
5. App shows toast: **"Welcome to Pro! AI features are now unlocked."**
6. All previously locked features become interactive.

If after 5 polling attempts (10 seconds) `isSubscribed` is still false, the app shows:
> "Your payment is confirmed. Access will activate shortly — refresh if it doesn't appear in a minute."

### 8e. Ongoing subscription

- On each app launch, `GET /api/v1/users/current` is called.
- `isSubscribed` is derived server-side from `subscriptionPlan`, `stripeSubscriptionStatus`, and `subscriptionExpiresAt`.
- The app does not need to track billing cycles; the backend handles all Stripe webhook events.

### 8f. Subscription cancelled / expired

1. Stripe fires `customer.subscription.deleted` (or `customer.subscription.updated` with `canceled` status).
2. Backend sets `subscriptionPlan = "free"`, clears expiry fields.
3. On next API call, `isSubscribed = false`.
4. User is redirected to `/account/settings/subscriptions` when accessing any Pro-gated route.

---

## 9. Frontend: Subscriptions Screen

**Route:** `/account/settings/subscriptions`

**Components:**

| Section | Description |
|---|---|
| Header | Back arrow → navigates to Profile (not browser back, to avoid SubscriptionGuard loop) |
| Current plan card | Shows plan name ("Free" or "Pro") + status message |
| Plan overview | Two cards side by side: Free and Pro |
| Free card | Highlighted with green ring when current. Feature list. |
| Pro card | Green border when not subscribed ("Unlock AI features" badge). Highlighted with green ring when current. Feature list. CTA button. |
| Support link | Link to `/contact` |

**CTA button states:**

| User state | Button text | Action |
|---|---|---|
| Not subscribed | "Upgrade to Pro" | `POST /api/v1/stripe/checkout` → open URL |
| Not subscribed (loading) | "Preparing checkout…" + spinner | Disabled |
| Subscribed | "Manage subscription" | `POST /api/v1/stripe/portal` → open URL |
| Subscribed (loading) | "Opening portal…" + spinner | Disabled |

---

## 10. UI Copy and Plan Feature Lists

### Free plan features
- Basic pronunciation practice
- Progress tracking
- Limited daily activity

### Pro plan features
- Eklan Free Talk — unlimited AI conversation practice sessions
- Eklan Pressure Test — timed, high-pressure AI speaking drills
- Full access to all current and future AI-powered features
- AI-driven feedback and scoring on every session
- Personalised difficulty that adapts as you improve

### Status messages

| State | Message shown under plan name |
|---|---|
| Free | "Upgrade to Pro to unlock Eklan Free Talk, Pressure Test, and all AI features." |
| Pro | "You have full access to AI features — dive in!" |

### Locked feature hint (hover / tap tooltip)
> "Upgrade to Pro to use this feature."

### Pro badge label (on locked UI elements)
`Pro` (shown as a small orange pill)

---

## 11. Subscription Gating

### Guard hierarchy (applied to all student routes)

```
RoleGuard ("user" only)
  └─ VerificationGuard (email must be verified)
       └─ OnboardingGuard (profile must be complete)
            └─ SubscriptionGuard (redirects non-Pro to subscriptions)
```

### SubscriptionGuard allowlist (free tier may access)

These routes are open to non-subscribed users:

```
/account                         (home dashboard — shows upsell UI)
/account/onboarding
/account/welcome
/account/settings/subscriptions
/account/settings/terms
/account/settings/privacy
/account/settings/contact
/account/settings/faq
/account/settings/help
/account/settings
/account/profile
/account/payment
/account/faq
/account/practice               (practice hub — shows locked cards)
/account/drills                 (My Plans list — shows locked rows)
```

**All other `/account/*` routes are Pro-gated** and redirect to `/account/settings/subscriptions`.

### Route aliases
`/home` is a rewrite alias for `/account`. `/practice` is a rewrite alias for `/account/practice`. The guard normalizes these before matching.

---

## 12. Locked UI Patterns

When `user.isSubscribed === false`, individual UI elements show a locked state:

| Element | Locked resting state | On hover / tap |
|---|---|---|
| Assigned drill action button (home) | Muted "Pro" button with lock icon | Morphs to green "Click me" → opens subscriptions |
| "View Sessions" button (home) | Full-width muted outline button with lock | Morphs to green "Click me" |
| Eklan Free Talk / Pressure Test cards | Dimmed card with swap CTA on left | "Click me" on the CTA control; tooltip follows pointer |
| My Plans drill rows | Non-navigable row with compact "Click me" on right | Green "Click me" on hover |
| "See all" drills link (home) | Muted chip with lock icon | Green "Click me" chip on hover |
| "My Plan" bottom nav tab | Normal link (route is allowlisted) | n/a |

A cursor-following tooltip showing **"Upgrade to Pro to use this feature."** appears near the pointer while hovering any locked zone.

---

## 13. Post-Checkout Success Handling

When Stripe redirects back to the app after payment:

1. Detect the `?checkout=success` query parameter in the URL.
2. Immediately strip the parameter from the URL (prevent re-triggering on refresh).
3. Invalidate the user cache (`GET /api/v1/users/current`).
4. Start polling every **2 seconds**, up to **5 attempts (10 seconds)**:
   - If `user.isSubscribed === true` → stop polling, show success toast.
   - If 5 attempts exhausted → show informational toast.
5. The webhook usually fires within 1–3 seconds of the redirect.

**Mobile note:** Use a deep link (e.g. `eklan://subscription/success`) as the Stripe success URL, then open the subscriptions screen and start polling.

---

## 14. Billing Portal (Manage Subscription)

Shown only when `user.isSubscribed === true`.

1. App calls `POST /api/v1/stripe/portal`.
2. Backend creates a Billing Portal session with `return_url` pointing back to the subscriptions screen.
3. Returns `{ url }`.
4. App opens the URL in browser.
5. User can: cancel subscription, update payment method, download invoices.
6. On return, the app should refresh the user profile to pick up any status changes.

---

## 15. Admin: Manual Stripe Sync

**Endpoint:** `POST /api/v1/admin/users/stripe-sync`  
**Access:** Admin role only.

Used when a webhook was missed or failed and a user's subscription is not reflecting correctly. Pass `email`, `userId`, or `stripeCustomerId`.

The endpoint:
1. Looks up the user in MongoDB.
2. Resolves the Stripe Customer (by stored ID or email search).
3. Fetches all subscriptions from Stripe.
4. If an `active` or `trialing` subscription is found, upgrades the user to `premium` and updates all fields.
5. Returns a before/after diff.

---

## 16. Mobile Implementation Checklist

### Backend (shared with web — no changes needed unless hosting separately)
- [ ] `STRIPE_SECRET_KEY` configured
- [ ] `STRIPE_WEBHOOK_SECRET` configured
- [ ] `STRIPE_PREMIUM_MONTHLY_PRICE_ID` configured
- [ ] Webhook endpoint registered in Stripe Dashboard: `POST /api/v1/webhooks/stripe`
- [ ] Events subscribed in Stripe Dashboard: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- [ ] Update `success_url` in checkout to use mobile deep link (e.g. `eklan://subscription/success?checkout=success`)
- [ ] Update `cancel_url` to mobile deep link (e.g. `eklan://subscription/cancel`)
- [ ] Update `return_url` in billing portal to mobile deep link

### Mobile app screens

#### Subscriptions screen
- [ ] Call `GET /api/v1/users/current` on load to get `isSubscribed`, `subscriptionPlan`, `subscriptionExpiresAt`
- [ ] Display current plan card: plan name + status message
- [ ] Display Free plan card with feature list
- [ ] Display Pro plan card with feature list + CTA button
- [ ] "Upgrade to Pro" → `POST /api/v1/stripe/checkout` → open `url` in browser/WebView
- [ ] "Manage subscription" (Pro users only) → `POST /api/v1/stripe/portal` → open `url`
- [ ] Handle loading states with spinner
- [ ] Handle errors with toast/alert

#### Post-checkout flow
- [ ] Register deep link handler for `eklan://subscription/success`
- [ ] On deep link received: navigate to subscriptions screen
- [ ] Start polling `GET /api/v1/users/current` every 2 seconds (max 5 attempts)
- [ ] On `isSubscribed === true`: show success message, unlock UI
- [ ] On max attempts reached: show informational message

#### Feature gating
- [ ] After every app launch and after checkout, call `GET /api/v1/users/current` and store `isSubscribed`
- [ ] Locked drill action buttons: show "Pro" badge at rest; on tap show upgrade prompt or navigate to subscriptions
- [ ] Locked practice cards (Free Talk, Pressure Test): show locked state; on tap → subscriptions screen
- [ ] Locked "View Sessions": show locked state; on tap → subscriptions screen
- [ ] My Plans list: accessible for free users; rows show locked state, tap → subscriptions screen
- [ ] Route guard equivalent: check `isSubscribed` before allowing navigation to Pro-only screens

#### Navigation
- [ ] Back from Subscriptions screen → navigate to Profile (not browser back, to avoid guard loop)

### Stripe Dashboard configuration
- [ ] Create a Product with a recurring monthly Price
- [ ] Copy the Price ID → `STRIPE_PREMIUM_MONTHLY_PRICE_ID`
- [ ] Enable Billing Portal (Settings → Billing → Customer portal)
- [ ] Set up webhook endpoint pointing to your API URL
- [ ] Enable promotion codes on Checkout if desired
