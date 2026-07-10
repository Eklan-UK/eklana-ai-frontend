# Interview Preparation — Mission 4 Learning Journey Catalog Update (Mobile Spec)

> **Version:** 2.1 · **Date:** July 2026  
> **Purpose:** Mobile handoff for **Mission 4: Interview Preparation** — a dedicated mission with eight interview-focused topics in the Drill Builder catalog and learner My Plan / Mission Detail screens.  
> **Prerequisites:** Read [`MOBILE_README.md`](MOBILE_README.md) for auth, error envelope, and React Query conventions.  
> **Web source of truth:** `src/domain/learning-journey/learning-journey.catalog.ts`  
> **Related specs:** [`eklan-mobile-learning-journey-spec.md`](eklan-mobile-learning-journey-spec.md) · [`MOBILE_DRILL_BUILDER_LIST.md`](MOBILE_DRILL_BUILDER_LIST.md)

---

## Overview

Interview Preparation is **Mission 4** with eight ordered topics. Drills use the standard drill builder (no Free Talk scenario mapping — same pattern as Grammar under Mission 5).

Tutors/admins creating or editing drills select **Mission 4** and one of the topics below. Saved drills store:

```typescript
learning_journey_part: 4
learning_journey_topic: "motivation_prep" // or technical_prep, situation_judgement_prep, mock_1 … mock_5
```

The learner Mission 4 detail screen must render all eight topic sections even when no drills are assigned yet.

> **Deprecation:** The legacy slug `interview_preparation` (previously under Bonus Scenarios) is removed. Existing drills are migrated via `scripts/swap-mission-4-and-5.ts` (interview topics → Mission 4; bonus topics → Mission 5).

---

## Mission 4: Interview Preparation — topics

| Order | Topic ID | Title | Free Talk scenario type |
|------:|----------|-------|-------------------------|
| 1 | `motivation_prep` | Motivation prep | *(none — standard drill builder)* |
| 2 | `technical_prep` | Technical prep | *(none)* |
| 3 | `situation_judgement_prep` | Situation Judgement Prep | *(none)* |
| 4 | `mock_1` | Mock 1 | *(none)* |
| 5 | `mock_2` | Mock 2 | *(none)* |
| 6 | `mock_3` | Mock 3 | *(none)* |
| 7 | `mock_4` | Mock 4 | *(none)* |
| 8 | `mock_5` | Mock 5 | *(none)* |

---

## Mission 5: Bonus Scenarios

Mission 5 (**Bonus Scenarios**) has **four** topics only:

| Order | Topic ID | Title |
|------:|----------|-------|
| 1 | `phone_colleagues` | Phone Communication with Colleagues |
| 2 | `phone_other_departments` | Phone Communication with Other Departments |
| 3 | `phone_patient_families` | Phone Communication with the Patient's Families |
| 4 | `grammar` | Grammar |

---

## Mobile actions required

1. **Drill Builder (tutor/admin):** Add **Mission 4: Interview Preparation** with all eight topics. Ensure `interview_preparation` is not in any topic picker.
2. **Learner My Plan:** Show five mission cards (Missions 1–5). Mission 4 card navigates to Mission 4 detail.
3. **Learner Mission Detail:** Render all eight Mission 4 topic sections even when empty. See [`eklan-mobile-learning-journey-spec.md`](eklan-mobile-learning-journey-spec.md) §4.4.
4. **Validation:** Server accepts Mission 4 topic slugs when paired with `learning_journey_part: 4`. Legacy `interview_preparation` is rejected.

> **Keep in sync:** Update mobile catalog constants in the same release as web when `learning-journey.catalog.ts` changes. There is no API for catalog versioning.

Full learner-side catalog spec: [`eklan-mobile-learning-journey-spec.md`](eklan-mobile-learning-journey-spec.md).

---

## Test plan

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Create drill with Mission 4 + topic `motivation_prep` | Saves without validation error; appears under Motivation prep on learner Mission 4 detail |
| 2 | Create drill with Mission 4 + topic `mock_3` | Saves; appears under Mock 3 topic group |
| 3 | Open learner Mission 4 detail before any drills assigned | All eight topic sections render with empty state |
| 4 | Mission 5 topic picker | Grammar + phone topics only; no Interview Preparation option |
| 5 | Legacy `interview_preparation` slug | Validation error on create/edit (after migration) |

---

## Changelog

| Date | Change |
|------|--------|
| July 2026 | **v2.1:** Interview Preparation is Mission 4; Bonus Scenarios is Mission 5 |
| July 2026 | **v2.0:** Interview Preparation promoted to dedicated mission with eight topics; `interview_preparation` removed from Bonus Scenarios |
| July 2026 | **v1.0:** Added Interview Preparation topic (order 5) under Bonus Scenarios |
