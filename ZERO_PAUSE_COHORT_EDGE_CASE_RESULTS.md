# Zero Pause Challenge / Maintainer — Edge Case Results

| Meta | Value |
|------|-------|
| **Date** | 2026-07-16 |
| **Tester** | agent (automated unit fill) |
| **Environment** | local |
| **Stripe mode** | test (live Test Clock cases not run) |
| **App commit** | `020747e` |

**Result values:** `Pass` | `Fail` | `Blocked` | `Skipped` | `Pending`

---

## Automated unit cases

| Case ID | Result | Actual | Notes |
|---------|--------|--------|-------|
| PAID-01 | Pass | `scheduled_legacy`; phases current→legacy; `proration_behavior: 'none'` | unit: “New $20 + no schedule → schedule → legacy at period end” |
| PAID-02 | Pass | prior = quarterly price; schedule phase 2 = legacy | unit: “Quarterly → schedule → legacy and stores prior quarterly price” |
| PAID-04 | Pass | `noop_already_legacy` / `released_schedule_only` | unit: legacy no-op + Phase-7 release-only |
| PAID-05 | Pass | prior unchanged on re-save | unit: “does not overwrite prior when re-saving Challenge” |
| PAID-06 | Pass | release then new schedule; `releasedScheduleId` set | unit: “New $20 + Phase 7 leftover → release then schedule → legacy” |
| MAINT-01 | Pass | `scheduled_restore` to new monthly; priors cleared | unit: “Legacy + Challenge→legacy schedule → release + restore prior monthly” |
| MAINT-02 | Pass | restore target quarterly; billing period quarterly | unit: prior quarterly restore + post-renewal simulation |
| MAINT-04 | Pass | `released_schedule_only`; no create | unit: “Already on target + Challenge schedule → release only” |
| MAINT-05 | Pass | second Challenge create with distinct idempotency key | unit: “monthly Challenge → Maintainer → Challenge again creates a new schedule” |
| MAINT-06 | Pass | `noop_already_target` → new monthly | unit: “Already on new monthly with no prior → no-op restore target” |
| EXP-02 | Pass | expiry → `maintainer`; dates kept | unit: `applyZeroPauseChallengeExpiry` only; live Checkout lazy restore **not** run |
| EXP-03 | Pass | active on end day; inactive + expire day after | unit: inclusive window + expiry |
| EXP-04 | Pass | false without dates / outside product rules | unit: `isZeroPauseChallengePricingActive` (false missing dates / non-challenge); future-start implied by start≤today check |
| UI-01 | Pass | monthly → legacy; quarterly → `challenge_period_not_allowed` | unit: “Challenge-active → legacy monthly; quarterly rejected” |
| UI-04 | Pass | public monthly/quarterly/annual; `challengePricing: false` | unit: Maintainer / empty products → new prices |
| EDGE-01 | Pass | `skipped_no_subscription` | unit: “skips when user has no Stripe subscription” |
| UNIT-01 | Pass | 70/70 pass (`test:phase8`); 9/9 (`test:zero-pause`) | ran 2026-07-16 locally |
| UNIT-02 | Pass | UTC midnight normalize | unit: `toUtcDayStart` |
| UNIT-03 | Pass | two phases; `proration_behavior: 'none'`; `end_behavior: 'release'` | unit: `schedulePriceChangeAtRenewal` |

---

## Manual / Stripe Test Clock cases

| Case ID | Result | Actual | Notes |
|---------|--------|--------|-------|
| SIGNUP-01 | Pending | | Needs live signup / DB assert |
| SIGNUP-02 | Pending | | Needs UI or Checkout session inspect |
| SIGNUP-03 | Pending | | Needs Stripe Checkout + trial; unit covers `subscriptionDataForCheckout` trial payload only |
| TRIAL-01 | Pending | | **Critical** — Test Clock mid-trial Challenge; verify `trial_end` unchanged |
| TRIAL-02 | Pending | | Test Clock / staging |
| TRIAL-03 | Pending | | Depends on TRIAL-01 |
| TRIAL-04 | Pending | | Depends on TRIAL-01 + clock advance |
| PAID-03 | Pending | | Annual path (same code as quarterly; no dedicated unit) |
| MAINT-03 | Pending | | Fallback without prior — needs targeted sync/admin run |
| DATE-01 | Pending | | Admin API/UI 400 |
| DATE-02 | Pending | | Admin API/UI 400 |
| DATE-03 | Pending | | Admin Maintainer clears dates + optional Stripe restore |
| DATE-04 | Pending | | Admin UI + API normalize |
| DATE-05 | Pending | | UI/schema smoke |
| DATE-06 | Pending | | Future start + Stripe sync vs Checkout inactive |
| EXP-01 | Pending | | Cron with secret + Mongo/Stripe |
| UI-02 | Pending | | Student subscriptions UI |
| UI-03 | Pending | | Post-expiry UI |
| EDGE-02 | Skipped | N/A | Apple IAP out of scope |
| EDGE-03 | Pending | | Cancel during Challenge window |
| ELIG-01 | Pending | | unit: `isEligibleForTrial` / `hasPriorStripeSubscriptions` pass in phase8; live re-Checkout not run |
| ELIG-02 | Pending | | Pre-launch + Challenge |
| ELIG-03 | Pending | | Links SIGNUP-03; live Checkout trial on public price not run |

---

## Fill log

| When | What |
|------|------|
| 2026-07-16 | `npm run test:phase8` → 70 pass, 0 fail (commit `020747e`) |
| 2026-07-16 | `npm run test:zero-pause` → 9 pass, 0 fail |
| 2026-07-16 | Marked unit-covered catalog IDs **Pass**; left Stripe Test Clock / admin/UI/cron live cases **Pending**; EDGE-02 **Skipped** |
