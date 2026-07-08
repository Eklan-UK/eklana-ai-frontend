# Interview Preparation Topic — Learning Journey Catalog Update (Mobile Spec)

> **Version:** 1.0 · **Date:** July 2026  
> **Purpose:** Mobile handoff for adding the **Interview Preparation** topic under Mission 4 (Bonus Scenarios) in the Drill Builder catalog and learner My Plan / Mission Detail screens.  
> **Prerequisites:** Read [`MOBILE_README.md`](MOBILE_README.md) for auth, error envelope, and React Query conventions.  
> **Web source of truth:** `src/domain/learning-journey/learning-journey.catalog.ts`  
> **Related specs:** [`eklan-mobile-learning-journey-spec.md`](eklan-mobile-learning-journey-spec.md) · [`MOBILE_DRILL_BUILDER_LIST.md`](MOBILE_DRILL_BUILDER_LIST.md) §7

---

## Overview

Learning journey missions and topics are defined in a hard-coded catalog on web. Mission 4 (**Bonus Scenarios**) now includes a fifth topic, **Interview Preparation**, for drill-only content (no Free Talk scenario mapping — same pattern as Grammar).

Tutors/admins creating or editing drills select Mission 4 and topic **Interview Preparation**. Saved drills store:

```typescript
learning_journey_part: 4
learning_journey_topic: "interview_preparation"
```

The learner Mission 4 detail screen must render an **Interview Preparation** section even when no drills are assigned yet.

---

## Mission 4: Bonus Scenarios — updated topics

| Order | Topic ID | Title | Free Talk scenario type |
|------:|----------|-------|-------------------------|
| 1 | `phone_colleagues` | Phone Communication with Colleagues | `phone_colleague` |
| 2 | `phone_other_departments` | Phone Communication with Other Departments | `phone_department` |
| 3 | `phone_patient_families` | Phone Communication with the Patient's Families | `phone_family` |
| 4 | `grammar` | Grammar | *(none — grammar drills use standard drill builder, not Free Talk)* |
| 5 | **`interview_preparation`** | **Interview Preparation** | *(none — interview prep drills use standard drill builder, not Free Talk)* |

---

## Mobile actions required

1. **Drill Builder (tutor/admin):** Add **Interview Preparation** to the Mission 4 topic picker. Topic value stored as `learning_journey_topic: "interview_preparation"`.
2. **Learner My Plan / Mission Detail:** Render the Interview Preparation topic section even when empty (same as other topics). See [`eklan-mobile-learning-journey-spec.md`](eklan-mobile-learning-journey-spec.md) §4.4.
3. **Validation:** Server accepts `"interview_preparation"` as a valid topic ID when paired with `learning_journey_part: 4`.

> **Keep in sync:** Update mobile catalog constants in the same release as web when `learning-journey.catalog.ts` changes. There is no API for catalog versioning.

Full learner-side catalog spec: [`eklan-mobile-learning-journey-spec.md`](eklan-mobile-learning-journey-spec.md).

---

## Test plan

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Create drill with Mission 4 + topic `interview_preparation` | Saves without validation error; appears under Interview Preparation on learner Mission 4 detail |
| 2 | Open learner Mission 4 detail before any interview prep drills assigned | Interview Preparation section renders with empty state |
| 3 | Assign interview prep drill to subscribed learner | Drill appears under Interview Preparation topic group in catalog order |

---

## Changelog

| Date | Change |
|------|--------|
| July 2026 | Added Interview Preparation topic (order 5) under Mission 4 Bonus Scenarios |
