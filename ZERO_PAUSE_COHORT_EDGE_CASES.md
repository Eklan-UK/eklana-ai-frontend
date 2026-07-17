# Zero Pause Challenge / Maintainer — Edge Case Catalog

Procedures to verify cohort pricing: signup defaults, admin Challenge/Maintainer toggles, Stripe Subscription Schedules at renewal (`proration_behavior: 'none'`), trial interactions, window expiry, and Checkout UI.

**Product rules (implementation lock):**

| Rule | Behavior |
|------|----------|
| Signup default | `zeroPauseProducts: ['maintainer']`, no dates; public prices US$20 / US$60 / $200 |
| Challenge + start/end | Legacy monthly (~US$1.99) scheduled at **renewal** via Subscription Schedules |
| Leave Challenge / Maintainer / expiry | Restore prior public price at renewal |
| Student Checkout | Challenge-active → legacy monthly only; else public periods |
| Mastery | Removed from assign UI (not a pricing driver) |

**Key code:** `stripe-challenge-pricing-sync.ts`, `stripe-price-migration.ts` (`schedulePriceChangeAtRenewal`), admin subscription route, cron `zero-pause-challenge-expiry`, checkout + `challengePricingActive`.

**Critical verification:** Assigning Challenge while `status === trialing` — intent is trial continues until `trial_end`; only the **first paid** renewal becomes ~$1.99. Confirm on Stripe Test Clock (see TRIAL-01).

**Observe fields (common):**

- **Stripe:** subscription `status`, `trial_end`, item price ID, `schedule`, schedule phases, upcoming invoice amount/date
- **Mongo user:** `zeroPauseProducts`, `zeroPauseDate`, `zeroPauseEndDate`, `zeroPausePriorStripePriceId`, `zeroPausePriorBillingPeriod`, `stripeScheduleId`, `subscriptionBillingPeriod`

**Automated coverage:** Cases marked *(unit)* are asserted by `npm run test:phase8` / `npm run test:zero-pause`. Live Stripe / admin UI cases need Test Clock or manual staging.

---

## 1. Signup / default Maintainer

### SIGNUP-01 — New user defaults to Maintainer

| Field | Detail |
|-------|--------|
| **ID** | SIGNUP-01 |
| **Title** | New account gets Maintainer cohort, no Challenge window |
| **Preconditions** | Fresh signup path (Better Auth and/or verify-id-token) on a clean email |
| **Steps** | 1. Complete signup. 2. Load `/api/v1/users/current` (or admin learner row). |
| **Expected** | `zeroPauseProducts` includes `maintainer` (typically `['maintainer']`). `zeroPauseDate` / `zeroPauseEndDate` null. `challengePricingActive` false. |
| **Observe** | Mongo `zeroPauseProducts`, `zeroPauseDate`, `zeroPauseEndDate`; `/users/current` → `challengePricingActive` |

### SIGNUP-02 — Maintainer Checkout shows public prices

| Field | Detail |
|-------|--------|
| **ID** | SIGNUP-02 |
| **Title** | Unsubscribed Maintainer sees US$20 / US$60 / $200 |
| **Preconditions** | User with Maintainer (or empty products), not subscribed, eligible or not for trial |
| **Steps** | 1. Open `/account/settings/subscriptions`. 2. Inspect billing period options. |
| **Expected** | Monthly US$20, 3 months US$60, 1 year $200. Checkout resolves public price IDs (`resolveCheckoutPriceForUser` → `challengePricing: false`). |
| **Observe** | UI labels; Checkout session `line_items[0].price` vs env public price IDs |

### SIGNUP-03 — Eligible Maintainer still gets 14-day trial CTA

| Field | Detail |
|-------|--------|
| **ID** | SIGNUP-03 |
| **Title** | Trial-eligible Maintainer Checkout attaches 14-day trial on public price |
| **Preconditions** | Post-launch account, never subscribed, no prior Stripe subs on customer |
| **Steps** | 1. Confirm `eligibleForTrial` true. 2. Start Checkout monthly (or any public period). |
| **Expected** | Session `subscription_data.trial_period_days === 14`. After success: Stripe `status: trialing`, public price on item. |
| **Observe** | Checkout create logs `eligibleForTrial`; Stripe sub `trial_end`, price ID |

---

## 2. Trial + cohort (highest priority)

### TRIAL-01 — Assign Challenge mid-trial *(critical)*

| Field | Detail |
|-------|--------|
| **ID** | TRIAL-01 |
| **Title** | Admin assigns Challenge while subscription is trialing |
| **Preconditions** | Stripe Test Clock (recommended). User on public monthly (or Q/A) with `status: trialing`, known `trial_end`. Admin access. |
| **Steps** | 1. Record Stripe: `status`, `trial_end`, current price, schedule (none). 2. Admin: Challenge + start (today or earlier) + end (future). Save. 3. Immediately re-read Stripe sub + schedule. 4. Advance Test Clock to day before `trial_end`, then past trial into first paid invoice. |
| **Expected (intent)** | After admin save: still `trialing`; `trial_end` unchanged (not shortened/ended). Access remains premium through trial. Schedule phases: phase 1 = current public price through period end (typically = trial end) **with `trial_end` set on the phase**; phase 2 = legacy ~$1.99. No mid-cycle charge. First paid renewal invoices legacy monthly. Mongo: `challenge` + dates; `zeroPausePriorStripePriceId` = prior public price; `stripeScheduleId` set when scheduled. |
| **Observe** | Stripe status/trial_end/schedule phases/upcoming invoice; Mongo prior + schedule fields; admin API `challengeStripeSync.status` (e.g. `scheduled_legacy`) |
| **Notes** | **Root cause (fixed in code):** `schedulePriceChangeAtRenewal` previously updated schedule phases **without** `trial_end`. Stripe can end the trial immediately on that update → first invoice attempted → `past_due` → webhook sets plan `free`. Fix: when `status === 'trialing'`, phase 1 includes `trial_end` (see `stripe-price-migration.ts`). Unit coverage: `stripe-price-migration.test.ts` + challenge sync trialing case. Live Stripe + Test Clock still recommended to confirm invoice timing. |

### TRIAL-02 — Assign Maintainer mid-trial (no Challenge)

| Field | Detail |
|-------|--------|
| **ID** | TRIAL-02 |
| **Title** | Setting Maintainer while trialing does not break trial |
| **Preconditions** | Trialing user already on Maintainer or with no Challenge |
| **Steps** | 1. Admin set/keep Maintainer (no Challenge dates). 2. Read Stripe. |
| **Expected** | Remains `trialing`; `trial_end` unchanged. No unwanted price schedule to legacy. Maintainer path only runs Stripe restore when **leaving** Challenge. |
| **Observe** | Stripe status/trial_end/schedule; Mongo products = maintainer, dates null |

### TRIAL-03 — Challenge then revert to Maintainer before trial ends

| Field | Detail |
|-------|--------|
| **ID** | TRIAL-03 |
| **Title** | Mid-trial Challenge → Maintainer restores public plan schedule |
| **Preconditions** | Complete TRIAL-01 through schedule creation (still trialing) |
| **Steps** | 1. Admin switch to Maintainer (clears dates). 2. Read Stripe schedule + Mongo priors. |
| **Expected** | Still `trialing`; `trial_end` unchanged. Challenge→legacy schedule released. If still on public price (= restore target): `released_schedule_only` / no new schedule needed. Priors cleared. First paid renewal stays on public price (not $1.99). |
| **Observe** | `maintainerStripeSync`; Stripe schedule absent or restore phases; `zeroPausePrior*` null |

### TRIAL-04 — Trial ends into Challenge legacy price

| Field | Detail |
|-------|--------|
| **ID** | TRIAL-04 |
| **Title** | After TRIAL-01, first paid period bills ~$1.99 |
| **Preconditions** | TRIAL-01 schedule in place; Test Clock |
| **Steps** | Advance clock past `trial_end` / first invoice. |
| **Expected** | Status `active` (or past_due if payment fails). Item price = legacy monthly. Invoice ~US$1.99 (test currency). |
| **Observe** | Invoice amount, subscription item price, schedule released after phase 2 starts |

---

## 3. Active paid + Challenge

### PAID-01 — Monthly $20 → schedule $1.99 at renewal *(unit: sync matrix)*

| Field | Detail |
|-------|--------|
| **ID** | PAID-01 |
| **Title** | Active public monthly → Challenge schedules legacy at period end |
| **Preconditions** | Active sub on new monthly price; no schedule (or leftover released first) |
| **Steps** | Admin assign Challenge with valid window overlapping today (for pricing active) / end ≥ today (for Stripe sync). |
| **Expected** | `scheduled_legacy`; `proration_behavior: 'none'`; phase 1 current monthly → period end; phase 2 legacy. Prior snapshot = new monthly. No `subscriptions.update`. |
| **Observe** | Schedule phases; Mongo prior + `stripeScheduleId` |
| **Unit** | `syncStripeForZeroPauseChallengePricing` — “New $20 + no schedule → schedule → legacy” |

### PAID-02 — Quarterly → schedule legacy; prior quarterly *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | PAID-02 |
| **Title** | Active quarterly → Challenge schedules legacy; stores prior quarterly |
| **Preconditions** | Active quarterly public price |
| **Steps** | Sync Challenge / admin assign Challenge. |
| **Expected** | Schedule current quarterly → legacy. `zeroPausePriorStripePriceId` = quarterly; `zeroPausePriorBillingPeriod` = `quarterly`. |
| **Observe** | Schedule phases; Mongo priors |
| **Unit** | “Quarterly → schedule → legacy and stores prior quarterly price” |

### PAID-03 — Annual → schedule legacy; prior annual

| Field | Detail |
|-------|--------|
| **ID** | PAID-03 |
| **Title** | Active annual → Challenge schedules legacy; stores prior annual |
| **Preconditions** | Active annual public price |
| **Steps** | Admin assign Challenge with end ≥ today. |
| **Expected** | Same as PAID-02 for annual price ID / `annual` period. No mid-cycle proration. |
| **Observe** | Schedule phases; Mongo priors |

### PAID-04 — Already on legacy monthly *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | PAID-04 |
| **Title** | Challenge sync no-ops when already on legacy |
| **Preconditions** | Sub item already legacy monthly; no conflicting need to schedule |
| **Steps** | Run Challenge sync. |
| **Expected** | `noop_already_legacy` (or `released_schedule_only` if Phase-7 leftover schedule on legacy). |
| **Observe** | No new schedule create when already on target without release path |
| **Unit** | “Legacy + no schedule → no-op”; “Legacy + Phase 7 schedule → release only” |

### PAID-05 — Prior-price snapshot on enter; preserve on re-save *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | PAID-05 |
| **Title** | Entering Challenge snapshots prior; re-saving Challenge keeps prior |
| **Preconditions** | User on public price; then already has prior from first enter |
| **Steps** | 1. Enter Challenge (`enteringFromNonChallenge: true`) → prior set. 2. Re-save Challenge (`enteringFromNonChallenge: false`) while still on public or mid window. |
| **Expected** | Step 1 sets prior from current non-legacy price. Step 2 does not overwrite existing prior. |
| **Observe** | Mongo `zeroPausePrior*` before/after |
| **Unit** | “does not overwrite prior when re-saving Challenge” |

### PAID-06 — Leftover Phase-7 schedule released then Challenge schedule *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | PAID-06 |
| **Title** | Existing schedule released before new Challenge→legacy schedule |
| **Preconditions** | Public monthly + existing `subscription.schedule` |
| **Steps** | Challenge sync. |
| **Expected** | Release old schedule; create new Challenge schedule; `releasedScheduleId` returned. |
| **Observe** | Stripe schedules release + create |
| **Unit** | “New $20 + Phase 7 leftover → release then schedule → legacy” |

---

## 4. Maintainer restore

### MAINT-01 — Leave Challenge restores prior monthly *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | MAINT-01 |
| **Title** | Maintainer after Challenge schedules restore to prior $20 |
| **Preconditions** | On legacy (or schedule to legacy) with `zeroPausePriorStripePriceId` = new monthly |
| **Steps** | Admin set Maintainer (or leave Challenge). |
| **Expected** | Restore target = prior monthly; schedule at renewal with `proration_behavior: 'none'`; priors cleared; `subscriptionBillingPeriod` restored. |
| **Observe** | `maintainerStripeSync`; schedule phases; Mongo priors null |
| **Unit** | “Legacy + Challenge→legacy schedule → release + restore prior monthly” |

### MAINT-02 — Restore prior quarterly / annual *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | MAINT-02 |
| **Title** | Maintainer restores quarterly (or annual) prior |
| **Preconditions** | Prior quarterly (or annual) snapshotted; currently on legacy |
| **Steps** | Maintainer sync. |
| **Expected** | `scheduled_restore` to prior price; billing period matches prior. |
| **Observe** | Schedule phase 2 price; Mongo billing period |
| **Unit** | “Legacy + prior quarterly → schedule restore to quarterly”; round-trip after renewal simulation |

### MAINT-03 — Missing prior snapshot fallback

| Field | Detail |
|-------|--------|
| **ID** | MAINT-03 |
| **Title** | Restore without prior uses billing period / public monthly fallback |
| **Preconditions** | User leaving Challenge with null `zeroPausePriorStripePriceId` |
| **Steps** | Maintainer sync / admin leave Challenge. |
| **Expected** | Target = `publicPriceIdForBillingPeriod(zeroPausePriorBillingPeriod \|\| subscriptionBillingPeriod)` else configured public monthly. Sync proceeds if that price exists. |
| **Observe** | `targetPriceId` in sync result / logs |

### MAINT-04 — Already on restore target → release only *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | MAINT-04 |
| **Title** | Mid-cycle leave while still on public price releases Challenge schedule only |
| **Preconditions** | Challenge schedule pending; item price still public (= prior) |
| **Steps** | Maintainer sync. |
| **Expected** | `released_schedule_only`; priors cleared; no new schedule. |
| **Observe** | Schedule released; create count 0 |
| **Unit** | “Already on target + Challenge schedule → release only”; round-trip tests |

### MAINT-05 — Toggle round-trip idempotency *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | MAINT-05 |
| **Title** | Challenge → Maintainer → Challenge creates a new schedule with unique key |
| **Preconditions** | Public monthly sub |
| **Steps** | Challenge sync → Maintainer sync → Challenge sync again with distinct idempotency keys. |
| **Expected** | Second Challenge creates a **new** schedule (not Stripe idempotency replay of first). |
| **Observe** | Two distinct schedule creates / idempotency keys |
| **Unit** | “monthly Challenge → Maintainer → Challenge again creates a new schedule” |

### MAINT-06 — Already on new monthly with no prior → noop *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | MAINT-06 |
| **Title** | Maintainer sync when already on public monthly is noop |
| **Preconditions** | Item = new monthly; no prior; no schedule |
| **Steps** | Maintainer sync. |
| **Expected** | `noop_already_target` with public monthly target. |
| **Observe** | No schedule create |
| **Unit** | “Already on new monthly with no prior → no-op restore target” |

---

## 5. Dates / admin validation

### DATE-01 — Challenge requires start and end

| Field | Detail |
|-------|--------|
| **ID** | DATE-01 |
| **Title** | Admin Challenge without both dates returns 400 |
| **Preconditions** | Admin UI or POST `/api/v1/admin/users/subscription` |
| **Steps** | Set products to include `challenge` with missing start and/or end. |
| **Expected** | HTTP 400 `ValidationError`: Challenge requires both start and end dates. Mongo unchanged for invalid request (no partial Challenge without dates). |
| **Observe** | Response body; admin toast/error |

### DATE-02 — End before start rejected

| Field | Detail |
|-------|--------|
| **ID** | DATE-02 |
| **Title** | Challenge end &lt; start rejected |
| **Preconditions** | Admin assign Challenge |
| **Steps** | start = 2026-08-10, end = 2026-08-01. Save. |
| **Expected** | HTTP 400: end must be on or after start. |
| **Observe** | Response message |

### DATE-03 — Maintainer clears Challenge dates

| Field | Detail |
|-------|--------|
| **ID** | DATE-03 |
| **Title** | Switching to Maintainer nulls window dates |
| **Preconditions** | User on Challenge with start/end |
| **Steps** | Admin set Maintainer only. |
| **Expected** | `zeroPauseProducts` = `['maintainer']` (normalized); `zeroPauseDate` / `zeroPauseEndDate` null. Stripe restore path if left Challenge + Stripe linked. |
| **Observe** | Mongo dates; `maintainerStripeSync` |

### DATE-04 — Challenge vs Maintainer mutual exclusivity

| Field | Detail |
|-------|--------|
| **ID** | DATE-04 |
| **Title** | Cannot keep both Challenge and Maintainer as pricing cohorts |
| **Preconditions** | Admin UI checkboxes or API array with both |
| **Steps** | 1. UI: select Challenge while Maintainer checked (or reverse). 2. API: POST both in array. |
| **Expected** | UI deselects the other. API `normalizeZeroPauseProducts` keeps Challenge and drops Maintainer if both sent. |
| **Observe** | Saved products array |

### DATE-05 — Mastery not assignable in admin UI

| Field | Detail |
|-------|--------|
| **ID** | DATE-05 |
| **Title** | Mastery removed from assign UI / API enum |
| **Preconditions** | Admin subscriptions page |
| **Steps** | Inspect Zero Pause product controls; schema accepts only `challenge` \| `maintainer`. |
| **Expected** | No Mastery checkbox. API Zod rejects `mastery` in update payload. |
| **Observe** | UI + 400 on invalid enum |

### DATE-06 — Challenge with future start still Stripe-syncs (end ≥ today)

| Field | Detail |
|-------|--------|
| **ID** | DATE-06 |
| **Title** | Admin Stripe Challenge sync gates on end date, not start |
| **Preconditions** | Stripe-linked sub; Challenge start = tomorrow; end = next month |
| **Steps** | Admin save Challenge. |
| **Expected** | Cohort saved. Stripe Challenge sync **runs** (`shouldSyncStripeForChallenge` only requires end ≥ today). Checkout/`challengePricingActive` remain **false** until start day (`isZeroPauseChallengePricingActive`). |
| **Observe** | `challengeStripeSync` present; `/users/current` `challengePricingActive` false until start UTC day |

---

## 6. Window expiry

### EXP-01 — Cron expires Challenge → Maintainer + Stripe restore

| Field | Detail |
|-------|--------|
| **ID** | EXP-01 |
| **Title** | Daily cron applies expiry and schedules Maintainer restore |
| **Preconditions** | User with `challenge`, `zeroPauseEndDate` &lt; today UTC; Stripe linked; prior snapshot set. Cron secret configured. |
| **Steps** | GET `/api/v1/cron/zero-pause-challenge-expiry` with auth. |
| **Expected** | Products → include `maintainer`, no `challenge`; dates kept as history. Stripe Maintainer restore scheduled/skipped per sync rules. Cron counters: `expired`, `migrationsScheduled` / `migrationsSkipped`. |
| **Observe** | Cron JSON; Mongo products/dates; Stripe schedule |

### EXP-02 — Checkout lazy expiry *(unit: apply expiry)*

| Field | Detail |
|-------|--------|
| **ID** | EXP-02 |
| **Title** | Checkout path expires Challenge then resolves public prices |
| **Preconditions** | Challenge with end date yesterday; user hits Checkout |
| **Steps** | POST `/api/v1/stripe/checkout` with billingPeriod monthly/quarterly. |
| **Expected** | `applyZeroPauseChallengeExpiry` mutates to Maintainer; restore helper runs when Stripe linked; price resolution uses public prices (`challengePricing: false`). |
| **Observe** | Mongo after checkout attempt; session price ID |
| **Unit** | `applyZeroPauseChallengeExpiry` mutations; checkout resolution for Maintainer |

### EXP-03 — End date inclusive (UTC day) *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | EXP-03 |
| **Title** | Challenge pricing active on end day; inactive day after |
| **Preconditions** | Window end = 2026-07-31 UTC |
| **Steps** | Evaluate `isZeroPauseChallengePricingActive` on end day 23:59 UTC and next day 00:00 UTC. Run `applyZeroPauseChallengeExpiry` same instants. |
| **Expected** | Active on end day; inactive and expiry applies only after end day. Dates preserved on expiry. |
| **Observe** | Function results / unit assertions |
| **Unit** | inclusive start/end; false day after; expiry keeps dates |

### EXP-04 — Before start date: not Challenge-active for Checkout *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | EXP-04 |
| **Title** | Before window start, Checkout uses public prices |
| **Preconditions** | `challenge` product; start in future; end in future |
| **Steps** | `isZeroPauseChallengePricingActive` / Checkout resolve with `now` before start. |
| **Expected** | Not active; quarterly/annual allowed; public price IDs. |
| **Observe** | `challengePricingActive` false |
| **Unit** | Active only inside inclusive window (implied by start/end checks) |

---

## 7. Checkout / UI

### UI-01 — Challenge-active blocks quarterly/annual *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | UI-01 |
| **Title** | Challenge-active Checkout rejects non-monthly periods |
| **Preconditions** | Challenge-active user (inside window) |
| **Steps** | `resolveCheckoutPriceForUser(..., 'quarterly')` or POST checkout with quarterly. |
| **Expected** | `challenge_period_not_allowed` / HTTP 400 with monthly-only message. Monthly → legacy price. |
| **Observe** | Status + message; monthly `priceId` = legacy |
| **Unit** | “Challenge-active → legacy monthly; quarterly rejected” |

### UI-02 — Student UI shows US$1.99 only when active

| Field | Detail |
|-------|--------|
| **ID** | UI-02 |
| **Title** | Subscriptions page Challenge options |
| **Preconditions** | `/users/current` returns `challengePricingActive: true` |
| **Steps** | Open subscriptions settings unsubscribed (or period picker). |
| **Expected** | Only Monthly US$1.99 option; selection forced to monthly. |
| **Observe** | UI options; network `challengePricingActive` |

### UI-03 — After expiry public plans return

| Field | Detail |
|-------|--------|
| **ID** | UI-03 |
| **Title** | Post-expiry UI shows public US$20 / US$60 / $200 |
| **Preconditions** | Challenge expired (cron or lazy) → Maintainer |
| **Steps** | Refresh subscriptions page. |
| **Expected** | `challengePricingActive` false; full public billing options. |
| **Observe** | UI + `/users/current` |

### UI-04 — Maintainer / empty products → public prices *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | UI-04 |
| **Title** | Maintainer and empty products resolve new price map |
| **Preconditions** | Configured public price IDs |
| **Steps** | Resolve monthly/quarterly/annual for Maintainer and `[]`. |
| **Expected** | Public price IDs; `challengePricing: false`. |
| **Observe** | Unit assertions |
| **Unit** | Maintainer / no products → new prices |

---

## 8. No Stripe / Apple / edge accounts

### EDGE-01 — Challenge with no Stripe subscription *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | EDGE-01 |
| **Title** | Challenge cohort saved; Stripe sync skipped |
| **Preconditions** | Premium manual or free user without `stripeSubscriptionId` / customer entitlement |
| **Steps** | Admin assign Challenge with dates. |
| **Expected** | Mongo Challenge saved. Sync result `skipped_no_subscription` (no Stripe error if no billing link — admin skips sync when no Stripe link). With Stripe customer but no sub: sync may skip similarly. |
| **Observe** | Mongo products; no `stripeScheduleId` from sync; API may omit `challengeStripeSync` if `hasStripeBillingLink` false |
| **Unit** | “skips when user has no Stripe subscription” |

### EDGE-02 — Apple subscriber (out of scope)

| Field | Detail |
|-------|--------|
| **ID** | EDGE-02 |
| **Title** | Apple IAP subscriber + Challenge admin assign |
| **Preconditions** | User with Apple billing link / `appleOriginalTransactionId` |
| **Steps** | Admin assign Challenge. |
| **Expected** | Cohort fields may save; Stripe schedule sync N/A for Apple. Document as out of scope for Stripe pricing. |
| **Observe** | N/A / Skipped for Stripe Test Clock suite |

### EDGE-03 — Cancel during Challenge window

| Field | Detail |
|-------|--------|
| **ID** | EDGE-03 |
| **Title** | Subscriber cancels while Challenge-active |
| **Preconditions** | Challenge-active Stripe sub with schedule to legacy |
| **Steps** | Cancel via Customer Portal (cancel at period end or immediately per product settings). |
| **Expected** | Cancellation behavior follows Stripe portal settings. Schedule may be released/canceled with sub. Cohort dates remain until admin/cron changes. No new unexpected charges beyond Stripe cancel rules. |
| **Observe** | Sub status `canceled` / `cancel_at_period_end`; schedule state |

---

## 9. Trial eligibility interactions

### ELIG-01 — Re-subscribe after trial: no second trial

| Field | Detail |
|-------|--------|
| **ID** | ELIG-01 |
| **Title** | Former trial user Checkout has no second 14-day trial |
| **Preconditions** | User previously activated subscription / prior Stripe subs on customer |
| **Steps** | Cancel/expire; start Checkout again as Maintainer. |
| **Expected** | `isEligibleForTrial` false and/or `hasPriorStripeSubscriptions` → no `trial_period_days` on session. |
| **Observe** | Checkout session payload; unit eligibility tests |

### ELIG-02 — Pre-launch account: no trial + Challenge assign

| Field | Detail |
|-------|--------|
| **ID** | ELIG-02 |
| **Title** | Pre-launch account not trial-eligible; Challenge still schedules at renewal |
| **Preconditions** | Account created before trial launch cutoff; may be paid or unpaid |
| **Steps** | Confirm `eligibleForTrial` false. If Stripe sub exists, assign Challenge. |
| **Expected** | No trial on Checkout. Challenge Stripe sync still schedules legacy at renewal when linked. |
| **Observe** | Eligibility flag; schedule if applicable |

### ELIG-03 — Eligible Maintainer Checkout trial on public prices *(links SIGNUP-03)*

| Field | Detail |
|-------|--------|
| **ID** | ELIG-03 |
| **Title** | Eligible Maintainer gets trial on public price (regression) |
| **Preconditions** | Same as SIGNUP-03 |
| **Steps** | Checkout monthly public. |
| **Expected** | 14-day trial on public monthly (not legacy). |
| **Observe** | Session subscription_data + price ID |
| **Unit** | `subscriptionDataForCheckout` / trial eligibility suite |

---

## 10. Regression / unit mapping

### UNIT-01 — `npm run test:phase8` green

| Field | Detail |
|-------|--------|
| **ID** | UNIT-01 |
| **Title** | Full Phase 8 + zero-pause unit suite passes |
| **Preconditions** | Repo checkout; Node with tsx |
| **Steps** | `npm run test:phase8` (includes `zero-pause-pricing.test.ts` and `stripe-challenge-pricing-sync.test.ts`). Optionally `npm run test:zero-pause`. |
| **Expected** | All tests exit 0. |
| **Observe** | Test runner summary |

### UNIT-02 — UTC day normalization *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | UNIT-02 |
| **Title** | `toUtcDayStart` normalizes to UTC midnight |
| **Preconditions** | None |
| **Steps** | Run zero-pause unit file. |
| **Expected** | `2026-07-16T15:30Z` → `2026-07-16T00:00:00.000Z`. |
| **Observe** | Unit assertion |
| **Unit** | `toUtcDayStart` |

### UNIT-03 — Schedule phases use proration none *(unit)*

| Field | Detail |
|-------|--------|
| **ID** | UNIT-03 |
| **Title** | `schedulePriceChangeAtRenewal` builds two phases with proration none |
| **Preconditions** | None |
| **Steps** | Run challenge pricing sync / price migration tests. |
| **Expected** | Create from_subscription; update phases current→target; `proration_behavior: 'none'`; `end_behavior: 'release'`. |
| **Observe** | Stub call log |
| **Unit** | `schedulePriceChangeAtRenewal` describe block |

---

## Suggested Test Clock run order (manual)

1. SIGNUP-03 / ELIG-03 — create trial on public monthly  
2. TRIAL-01 — assign Challenge mid-trial; verify `trial_end`  
3. TRIAL-03 — optional revert before trial ends  
4. TRIAL-04 — advance past trial; confirm ~$1.99  
5. PAID-01 / PAID-02 — paid (non-trial) Challenge schedules  
6. MAINT-01 / MAINT-02 — restore  
7. EXP-01 — cron after end date  
8. UI-02 / UI-03 — student UI  

Record outcomes in `ZERO_PAUSE_COHORT_EDGE_CASE_RESULTS.md`.
