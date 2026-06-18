# Eklan Learning Journey — Mobile Implementation Specification

> **Version:** 1.0 · **Date:** June 2026  
> **Purpose:** UI specification for the React Native / Expo team to mirror the Learning Journey, Saved Drills, and related My Plan / Home changes shipped on the Next.js web app.  
> **Web reference:** `src/app/(student)/account/drills/`, `src/app/(student)/account/drills/journey/[part]/`, `src/components/drills/SavedDrillsSection.tsx`, `src/components/drills/LearningJourneyPartCard.tsx`, `src/domain/learning-journey/learning-journey.catalog.ts`

---

## Table of Contents

1. [Overview](#1-overview)
2. [What Changed / What Was Removed](#2-what-changed--what-was-removed)
3. [Screen Flows](#3-screen-flows)
4. [Component Descriptions](#4-component-descriptions)
5. [Navigation](#5-navigation)
6. [UX Notes](#6-ux-notes)

---

## 1. Overview

The **Eklan Learning Journey System** reorganizes how learners discover and track assigned drills. Instead of a single flat list with Ongoing / Completed / Bookmarked tabs on **My Plans**, drills are now grouped into four curriculum **Parts**, each containing ordered **Topics** from a hard-coded catalog. Learners browse Parts → Topics → individual drill rows, bookmark drills for quick access, and see completion progress at the Part level.

### High-level user journey

```
Home                          My Plans
  │                               │
  ├─ Your Progress cards          ├─ Next Session Card
  ├─ Saved Drills (collapsible)   ├─ Saved Drills (collapsible)
  └─ Assigned Drills (top 4)      └─ My Learning Journey
                                        ├─ Part 1 card ──► Part Detail
                                        ├─ Part 2 card ──► Part Detail
                                        ├─ Part 3 card ──► Part Detail
                                        └─ Part 4 card ──► Part Detail
                                              │
                                              └─ Topics (sections)
                                                    └─ Drill rows per topic
```

### Key concepts

| Concept | Description |
|---|---|
| **Part** | One of four curriculum sections (1–4). Has a title and a list of topics. Progress shown as "X of Y drills completed". |
| **Topic** | A sub-section within a Part (e.g. "Handling Emergency/Critical Situation"). Drills are grouped under topics via `learning_journey_part` + `learning_journey_topic` fields on the drill document. |
| **Catalog** | Hard-coded list of Parts and Topics (see [§4.4](#44-learning-journey-catalog)). Always render all topics for a Part, even when no drills are assigned. |
| **Saved Drills** | Drills the learner has bookmarked (`hasBookmarks === true`). Shown in a collapsible section on Home and My Plans. |
| **Drill row** | Tappable card for a standard drill (`PlanDrillRow`) or Free Talk scenario (`PlanFreeTalkRow`). |

### Subscription gate

**My Plans** (`/account/drills`) and **Part Detail** require an active Pro subscription on web. Unsubscribed users are redirected to the subscription screen. Mirror this gate on mobile before rendering these screens.

---

## 2. What Changed / What Was Removed

### 2.1 My Plans page (`/account/drills`)

#### Removed

| Element | Previous behavior |
|---|---|
| **"Assigned Drills" heading** | Section title above the drill list |
| **Tab bar** | Three tabs: **Ongoing**, **Completed**, **Bookmarked** |
| **Tab-filtered drill list** | List filtered by selected tab; Bookmarked tab showed bookmarked drills |

The entire Assigned Drills + tabs block is **gone**. Bookmarked drills now live exclusively in the **Saved Drills** collapsible. All assigned drills are reachable through **My Learning Journey** Part cards.

#### Added (top to bottom, in this order)

| # | Section | Notes |
|---|---|---|
| 1 | **Next Session Card** | Unchanged from prior implementation |
| 2 | **Saved Drills** | New collapsible section (shared component) |
| 3 | **My Learning Journey** | New heading + 4 Part cards |

#### Unchanged

- Page title: **"My Plans"**
- Subtitle: **"Designed for you, based on your goals"**
- Header actions: Achievements link, Streak badge, Notification bell
- Bottom tab navigation
- Subscription gate for unsubscribed users

---

### 2.2 Home page (`/account`)

#### Removed

| Element | Location | Notes |
|---|---|---|
| **"Saved Words" link** | Inside **Your Progress** section | Was a navigational link/card alongside progress metric cards |

#### Added

| Element | Location | Notes |
|---|---|---|
| **Saved Drills** collapsible | Directly below the Your Progress card grid, above Assigned Drills | Same component and behavior as on My Plans |

#### Unchanged

- **Your Progress** heading and metric cards (Confidence, Pronunciation, Accurate Sentence, Response Speed)
- **Assigned Drills** section below Saved Drills — still shows top **4** active/incomplete drills with "See all" link to My Plans
- Today's Focus, greeting header, push notification prompt, bottom nav

---

### 2.3 New screen: Part Detail (`/account/drills/journey/[1-4]`)

Brand-new screen. Shows all topics for the selected Part, each with its assigned drill rows.

---

### 2.4 Drill row visual change (all contexts)

| Change | Detail |
|---|---|
| **Completion indicator** | Green `CheckCircle2` icon (`#22c55e`) shown on the trailing edge when drill/scenario is completed |
| **Bookmark toggle** | Available on `PlanDrillRow` in Saved Drills and Part Detail contexts |

---

## 3. Screen Flows

### 3.1 My Plans — full layout

```
┌─────────────────────────────────────────┐
│  [safe area top]                        │
├─────────────────────────────────────────┤
│  My Plans                    [🏆][🔥][🔔]│
│  Designed for you, based on your goals  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Next Session Card ────────────────┐ │
│  │  (unchanged)                       │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ Saved Drills (collapsed) ─────────┐ │
│  │ [🔖] Saved Drills          [3] [▼] │ │
│  └────────────────────────────────────┘ │
│                                         │
│  My Learning Journey                    │
│  ┌─ Part 1 ────────────────────── [›] ┐ │
│  │ [1] PART 1                          │ │
│  │     Communication with Patients     │ │
│  │     2 of 8 drills completed       │ │
│  └────────────────────────────────────┘ │
│  ┌─ Part 2 ────────────────────── [›] ┐ │
│  │ ...                                 │ │
│  └────────────────────────────────────┘ │
│  ┌─ Part 3 ────────────────────── [›] ┐ │
│  └────────────────────────────────────┘ │
│  ┌─ Part 4 ────────────────────── [›] ┐ │
│  └────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│  [Bottom Tab Bar]                       │
└─────────────────────────────────────────┘
```

#### Interactions

| Action | Result |
|---|---|
| Tap **Part N card** | Navigate to Part Detail for that part (`/account/drills/journey/N`) |
| Tap **Saved Drills header row** | Toggle expand/collapse |
| Tap **Achievements** (star icon) | Navigate to streak/achievements screen |
| Tap **Streak badge** | Navigate to streak detail |
| Tap **Notification bell** | Open notifications |

#### Data loading

- Fetch learner drills (`limit: 100`) on mount
- Compute per-Part progress: `{ completed, total }` for each Part 1–4
- Part cards always render all 4 parts regardless of assignment state

---

### 3.2 Saved Drills — collapsed vs expanded

#### Collapsed state (default)

```
┌─────────────────────────────────────────┐
│ [🔖]  Saved Drills              [▼]    │
│       3 saved drills                    │  ← or "No saved drills yet" / "Loading…"
└─────────────────────────────────────────┘
```

| Subtitle text | Condition |
|---|---|
| `Loading…` | Drills query in flight |
| `No saved drills yet` | Loaded, zero bookmarked drills |
| `1 saved drill` | Exactly one bookmarked |
| `N saved drills` | N > 1 bookmarked |

| Badge (count pill) | Condition |
|---|---|
| Hidden | Loading, or zero bookmarked |
| Shows count | One or more bookmarked drills |

#### Expanded state

```
┌─────────────────────────────────────────┐
│ [🔖]  Saved Drills         [3]  [▲]    │
│       3 saved drills                    │
└─────────────────────────────────────────┘
        ↓ 12px gap
┌─ PlanDrillRow ─────────────────────────┐
│ [thumb] Drill title            [✓][🔖][›]│
│         • Vocabulary                    │
│         🕐 5–15 minutes                 │
└─────────────────────────────────────────┘
┌─ PlanFreeTalkRow ──────────────────────┐
│ [💬]  Free Talk title          [✓] [›] │
│       • ICU Emergency                   │
│       🕐 5–15 minutes                   │
└─────────────────────────────────────────┘
```

| Action | Result |
|---|---|
| Tap **header row** | Collapse section |
| Tap **drill row** (non-bookmark area) | Navigate to drill session or completed summary |
| Tap **bookmark button** on `PlanDrillRow` | Toggle bookmark; refresh list; show toast |
| Tap **bookmark button** on `PlanFreeTalkRow` | *(Web parity note: bookmark UI not yet on Free Talk rows on web; implement on mobile only if product confirms.)* |

#### Empty expanded state

```
┌─────────────────────────────────────────┐
│         📖 (BookOpen icon)              │
│  Bookmark drills from your learning     │
│  journey to find them here.             │
└─────────────────────────────────────────┘
```

#### Loading expanded state

Centered green spinner (`#22c55e`), vertically padded.

#### Auto-expand

When navigating to My Plans with deep link / hash `#saved-drills`, the section **must expand on mount**.

---

### 3.3 Part Detail — full layout

**Route:** `/account/drills/journey/{part}` where `{part}` ∈ `{1, 2, 3, 4}`

```
┌─────────────────────────────────────────┐
│  [←] My Learning Journey                │  ← back link
│  PART 1                                 │
│  Communication with Patients            │  ← H1
├─────────────────────────────────────────┤
│                                         │
│  Handling Emergency/Critical Situation  │  ← topic heading
│  ┌─ PlanDrillRow ────────────────────┐  │
│  └───────────────────────────────────┘  │
│  ┌─ PlanDrillRow ────────────────────┐  │
│  └───────────────────────────────────┘  │
│                                         │
│  Conducting CPR                         │  ← topic heading
│  ┌───────────────────────────────────┐  │
│  │ No drills assigned for this topic   │  │
│  │ yet.                              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Follow-up with Patients                │
│  ...                                    │
│                                         │
├─────────────────────────────────────────┤
│  [Bottom Tab Bar]                       │
└─────────────────────────────────────────┘
```

#### Header anatomy

| Element | Content | Style |
|---|---|---|
| Back control | `←` + "My Learning Journey" | Tappable; navigates to My Plans |
| Part label | `Part {N}` | Uppercase, small, muted, semibold |
| Title | Part title from catalog | Large bold heading (e.g. `text-2xl`) |

#### Body anatomy

- Render **every topic** from the catalog for this Part, in catalog order
- Each topic is a `<section>` with:
  1. **Topic heading** — topic title, bold, `text-base`
  2. **Drill list** or **empty state card**

#### Topic empty state

When a topic has zero assigned drills:

```
┌─────────────────────────────────────────┐
│  No drills assigned for this topic yet. │
└─────────────────────────────────────────┘
```

Centered muted text inside a card with padding.

#### Invalid Part ID

If `{part}` is not 1, 2, 3, or 4, redirect to My Plans (`/account/drills`).

#### Loading state

Full-body centered green spinner until drills query resolves.

#### Interactions

| Action | Result |
|---|---|
| Tap **back link** | Pop to My Plans |
| Tap **drill row** | Navigate to drill (see [§4.2](#42-plandrillrow)) |
| Tap **bookmark** on drill row | Toggle bookmark, invalidate drill cache, toast feedback |
| Tap **Free Talk row** | Navigate to Free Talk session screen |

---

### 3.4 Home page — Your Progress area

```
┌─────────────────────────────────────────┐
│  Your Progress                          │
│  ┌──────────┐  ┌──────────┐            │
│  │Confidence│  │Pronunciat│            │  ← unchanged metric cards
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │ Accurate │  │ Response │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  ┌─ Saved Drills (collapsible) ───────┐ │  ← NEW (replaces Saved Words link)
│  └────────────────────────────────────┘ │
│                                         │
│  Assigned Drills              See all ›│  ← unchanged
│  ┌─ DrillCard / PlanFreeTalkRow ──────┐ │
│  │  (top 4 active/incomplete)          │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Saved Words link is removed.** Do not render it anywhere on Home.

The Saved Drills component is **identical** to the My Plans instance (same props defaults, same behavior, same `id="saved-drills"`).

---

### 3.5 End-to-end navigation diagram

```
                    ┌──────────────┐
                    │     Home     │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐  ┌───────────┐  ┌──────────────┐
    │ Saved Drills│  │ Assigned  │  │ See all ─────┼──┐
    │ (expand)    │  │ Drills    │  └──────────────┘  │
    └──────┬──────┘  └─────┬─────┘                     │
           │               │                            │
           │ tap drill     │ tap drill                  │
           ▼               ▼                            ▼
    ┌─────────────────────────────────────────────────────────┐
    │              Drill Session / Free Talk Session           │
    └─────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   My Plans   │◄─────────────────────────────────────────┘
    └──────┬───────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐  ┌───────────────┐
│ Saved   │  │ Part N card   │
│ Drills  │  └───────┬───────┘
└────┬────┘          │
     │               ▼
     │        ┌──────────────┐
     │        │ Part Detail  │
     │        │ (topics +    │
     │        │  drill rows) │
     │        └──────┬───────┘
     │               │
     └───────┬───────┘
             ▼
    ┌────────────────────┐
    │ Drill / Free Talk  │
    │ Session            │
    └────────────────────┘
```

---

## 4. Component Descriptions

### 4.1 `SavedDrillsSection`

Shared collapsible section used on **Home** and **My Plans**.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `"saved-drills"` | Section anchor ID for deep-link auto-expand |
| `title` | `string` | `"Saved Drills"` | Header title (i18n key: `account.savedDrills`) |
| `defaultExpanded` | `boolean` | `false` | Initial expanded state |

#### Data source

- Fetch learner drills with `limit: 100`
- Filter: `item.hasBookmarks === true`
- Sort: same order as `sortAssignedPlanItems` on web (active/incomplete first, then by due date)

#### Header row layout (left → right)

| # | Element | Spec |
|---|---|---|
| 1 | Icon container | 40×40, `rounded-xl`, bg `orange-100` (dark: `orange-900/30`) |
| 2 | Bookmark icon | 20×20, `orange-600` (dark: `orange-400`) |
| 3 | Title + subtitle | Flex-1; title bold `text-base`; subtitle `text-xs` muted |
| 4 | Count badge | Optional pill: `rounded-full`, muted bg, `text-xs` — only when loaded and count > 0 |
| 5 | Chevron | `ChevronDown` collapsed / `ChevronUp` expanded, muted, 20×20 |

#### Container styles

- Full-width tappable row
- `rounded-2xl`, card background, 1px border, `p-4`, subtle shadow
- On press: slightly elevated shadow (hover equivalent on mobile: opacity or scale feedback)

#### Expanded panel

- `mt-3` gap below header
- Vertical stack of drill rows, `space-y-3`
- Each row: `PlanDrillRow` or `PlanFreeTalkRow` based on `isFreeTalkPlanItem(item)`

#### Accessibility

- Header is a single `button` with `aria-expanded` and `aria-controls` pointing to panel ID `{id}-panel`

---

### 4.2 `PlanDrillRow`

Standard assigned drill card. Used in Saved Drills, Part Detail, and elsewhere.

#### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `drill` | `{ _id, title, type, date }` | ✓ | Drill document |
| `assignmentId` | `string` | | Assignment ID for deep-linking |
| `dueDate` | `string` | | ISO due date |
| `completedAt` | `string` | | Completion timestamp |
| `status` | `string` | | Assignment status (`in-progress`, etc.) |
| `hasBookmarks` | `boolean` | | Whether drill is bookmarked |
| `onBookmarkToggle` | `(drillId, bookmarked) => void` | | Bookmark handler |
| `onNavigate` | `() => void` | | Pre-navigation callback (analytics) |

#### Layout (left → right)

```
┌──────┬────────────────────────────┬─────────────────┐
│ 56px │  Title (2-line clamp)      │ [✓] [🔖] [›]  │
│thumb │  • {type label}            │                 │
│      │  🕐 5–15 minutes            │                 │
└──────┴────────────────────────────┴─────────────────┘
```

| Zone | Spec |
|---|---|
| **Thumbnail** | 56×56 (`w-14 h-14`), `rounded-xl`, type-colored gradient, emoji icon from drill type |
| **Title** | Semibold, `text-sm`, max 2 lines |
| **Type label** | `• {getDrillTypeLabel(type)}`, colored per drill type category |
| **In progress** | If `status` is `in-progress` / `in_progress` and not completed: append `· In progress` in sky blue |
| **Duration** | Clock icon + `"5–15 minutes"` |
| **Completed icon** | Green `CheckCircle2` 20×20 when `getDrillStatus(...) === "completed"` |
| **Bookmark button** | Ghost circular button; green filled `BookmarkCheck` when saved, outline `Bookmark` when not; spinner while loading |
| **Chevron** | Muted `ChevronRight` 20×20 |

#### Bookmark button colors

| State | Icon | Color |
|---|---|---|
| Not bookmarked | `Bookmark` | Muted foreground; press → green |
| Bookmarked | `BookmarkCheck` | `#22c55e` (green-500) |
| Loading | `Loader2` spin | Muted |

#### Navigation targets

| Condition | Destination |
|---|---|
| Completed + has `assignmentId` | `/account/drills/{drillId}/completed?assignmentId={assignmentId}` |
| Has `assignmentId` | `/account/drills/{drillId}?assignmentId={assignmentId}` |
| Otherwise | `/account/drills/{drillId}` |

#### Bookmark interaction

1. `preventDefault` + `stopPropagation` on bookmark tap (do not navigate)
2. Call `onBookmarkToggle(drill._id, hasBookmarks)`
3. Show loading spinner on button during API call
4. On success: invalidate drills query; toast:
   - Add: `"Added to bookmarks!"`
   - Remove: `"Removed from bookmarks"`
   - Already exists: `"Already bookmarked"` (info)
5. On error: toast `"Could not save bookmark"` / `"Could not remove bookmark"`

#### Card container

- `rounded-2xl`, card bg, border, `p-3`, shadow
- Entire card tappable except bookmark button

---

### 4.3 `PlanFreeTalkRow`

Free Talk scenario card. Used in Saved Drills, Part Detail, and Home Assigned Drills.

#### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `scenarioId` | `string` | ✓ | Scenario / assignment ID |
| `title` | `string` | ✓ | Scenario title |
| `scenarioType` | `string` | ✓ | Free Talk scenario type enum value |
| `completionDate` | `string \| Date` | | Due/completion date for due-soon badge |
| `completedAt` | `string \| Date` | | When learner completed |
| `locked` | `boolean` | | Pro lock state (Home assigned drills) |

#### Layout

```
┌──────┬────────────────────────────┬──────────┐
│ 56px │  Title (2-line clamp)      │ [✓] [›]  │
│ teal │  • {scenario type label}   │  or Pro  │
│ 💬   │  🕐 5–15 min  [Due badge]  │  lock    │
└──────┴────────────────────────────┴──────────┘
```

| Zone | Spec |
|---|---|
| **Thumbnail** | 56×56, gradient `emerald-200 → teal-300`, `MessageSquare` icon 28×28 emerald-800 |
| **Type label** | `• {freeTalkScenarioTypeLabel(scenarioType)}`, emerald text |
| **Duration** | `"5–15 minutes"` with clock icon |
| **Due-soon badge** | Amber pill with `AlertCircle` icon + `"Due {label}"` — only when `isFreeTalkScenarioDueSoon(completionDate, completed)` |
| **Completed icon** | Green `CheckCircle2` when `completedAt != null` |
| **Locked state** | `Lock` + "Pro" chip; entire row links to subscription screen |

#### Navigation

| Condition | Destination |
|---|---|
| Not locked | `/account/practice/free-talk/session?scenarioId={scenarioId}` |
| Locked | `/account/settings/subscriptions` |

#### Bookmark

Not implemented on web for Free Talk rows. Omit bookmark button on `PlanFreeTalkRow` unless product extends bookmark API to scenarios.

---

### 4.4 `LearningJourneyPartCard`

Summary card for one Part on My Plans.

#### Props

| Prop | Type | Description |
|---|---|---|
| `part` | `1 \| 2 \| 3 \| 4` | Part number |
| `completedCount` | `number` | Completed drills in this Part |
| `totalCount` | `number` | Total assigned drills in this Part |

#### Layout

```
┌──────┬────────────────────────────┬───┐
│  48px│  PART 1                    │ › │
│  [1] │  Communication with        │   │
│ green│  Patients                  │   │
│ grad │  2 of 8 drills completed   │   │
└──────┴────────────────────────────┴───┘
```

| Zone | Spec |
|---|---|
| **Badge** | 48×48, `rounded-xl`, gradient `emerald-100 → teal-200` (dark: `emerald-900/40 → teal-900/40`), bold part number `text-lg` emerald-800 |
| **Part label** | `Part {N}`, uppercase, `text-xs`, semibold, muted |
| **Title** | Part title from catalog, semibold `text-sm`, max 2 lines |
| **Progress** | If `totalCount > 0`: `"{completedCount} of {totalCount} drills completed"`; else: `"No drills assigned yet"` |
| **Chevron** | Muted `ChevronRight` 20×20 |

#### Interaction

- Entire card is tappable
- Navigate to `/account/drills/journey/{part}`

---

### 4.5 Learning Journey Catalog

**Hard-code this catalog in the mobile app** (mirror `src/domain/learning-journey/learning-journey.catalog.ts`). Do not fetch from API.

#### Part 1: Communication with Patients

| Order | Topic ID | Title | Free Talk scenario type |
|---|---|---|---|
| 1 | `handling_emergency_critical` | Handling Emergency/Critical Situation | `icu_emergency` |
| 2 | `conducting_cpr` | Conducting CPR | `cpr` |
| 3 | `patient_follow_up` | Follow-up with Patients | `patient_follow_up` |
| 4 | `admitting_patient` | Admitting a Patient | `admission` |
| 5 | `small_talk_patient` | Small Talk with a Patient | `small_talk_patient` |

#### Part 2: Communication with Colleagues

| Order | Topic ID | Title | Free Talk scenario type |
|---|---|---|---|
| 1 | `receiving_handover` | Receiving an Handover | `handover_receive` |
| 2 | `giving_handover` | Giving an Handover | `handover` |
| 3 | `declining_request` | Declining a Request and Professionally Saying No | `decline_request` |
| 4 | `small_talk_colleagues` | Small Talk with Colleagues | `small_talk_colleague` |

#### Part 3: Communication with Doctors, Families and Friends

| Order | Topic ID | Title | Free Talk scenario type |
|---|---|---|---|
| 1 | `providing_updates_doctor` | Providing Updates to a Doctor | `phone_doctor` |
| 2 | `doctor_rounds` | Going on Rounds with Doctors | `doctor_rounds` |
| 3 | `answering_family_questions` | Answering Families and Friend's Questions | `family_questions` |

#### Part 4: Bonus Scenarios

| Order | Topic ID | Title | Free Talk scenario type |
|---|---|---|---|
| 1 | `phone_colleagues` | Phone Communication with Colleagues | `phone_colleague` |
| 2 | `phone_other_departments` | Phone Communication with Other Departments | `phone_department` |
| 3 | `phone_patient_families` | Phone Communication with the Patient's Families | `phone_family` |

#### Drill-to-topic mapping (server-side fields)

Each drill document may include:

```typescript
learning_journey_part?: 1 | 2 | 3 | 4;
learning_journey_topic?: string; // topic ID from catalog
```

Client-side grouping logic:

1. Filter drills where `drill.learning_journey_part === selectedPart`
2. For each topic in catalog order, filter drills where `drill.learning_journey_topic === topic.id`
3. Sort items within each topic group using the same sort as assigned plan items

#### Progress calculation

```typescript
// Per part:
total = drills.filter(d => d.drill.learning_journey_part === part).length
completed = those where isCompletedPlanItem(item) === true
```

---

### 4.6 Part Detail topic section

Composable section, not a standalone file on web but worth naming for mobile:

| Element | Spec |
|---|---|
| Wrapper | `<section>` keyed by `topic.id` |
| Heading | `topic.title`, bold, `mb-3` |
| Content | Drill row list OR empty card |
| Spacing | `space-y-8` between topic sections |

---

### 4.7 Suggested React Native component tree

```
screens/
  MyPlansScreen.tsx
  LearningJourneyPartScreen.tsx      // part: 1|2|3|4 param

components/learning-journey/
  SavedDrillsSection.tsx
  LearningJourneyPartCard.tsx
  LearningJourneyTopicSection.tsx
  PlanDrillRow.tsx
  PlanFreeTalkRow.tsx

domain/learning-journey/
  learning-journey.catalog.ts        // hard-coded parts + topics
  group-journey-drills.ts            // filter/group/count helpers

hooks/
  useDrillBookmarkToggle.ts
  useLearnerDrills.ts
```

---

## 5. Navigation

### 5.1 Route map

| Web route | Mobile screen | Params |
|---|---|---|
| `/account` | `Home` | — |
| `/account/drills` | `MyPlans` | Optional: expand Saved Drills |
| `/account/drills#saved-drills` | `MyPlans` | `expandSavedDrills: true` |
| `/account/drills/journey/1` | `LearningJourneyPart` | `part: 1` |
| `/account/drills/journey/2` | `LearningJourneyPart` | `part: 2` |
| `/account/drills/journey/3` | `LearningJourneyPart` | `part: 3` |
| `/account/drills/journey/4` | `LearningJourneyPart` | `part: 4` |
| `/account/drills/{drillId}` | `DrillSession` | `drillId`, optional `assignmentId` |
| `/account/drills/{drillId}/completed` | `DrillCompleted` | `drillId`, `assignmentId` |
| `/account/practice/free-talk/session` | `FreeTalkSession` | `scenarioId` |

### 5.2 Stack hierarchy (recommended)

```
Root Tab Navigator
├── Home Tab
│   └── HomeScreen
├── My Plans Tab (or nested from Home "See all")
│   ├── MyPlansScreen
│   └── LearningJourneyPartScreen  (stack push)
├── Practice Tab
│   └── ...
└── ...
```

Part Detail should be a **stack push** on top of My Plans, with back returning to My Plans (not Home).

### 5.3 Deep linking

| URI pattern | Behavior |
|---|---|
| `eklan://account/drills` | Open My Plans |
| `eklan://account/drills#saved-drills` | Open My Plans, auto-expand Saved Drills |
| `eklan://account/drills/journey/{part}` | Open Part Detail for part N |

On web, hash `#saved-drills` triggers `useEffect` → `setExpanded(true)`. Mobile equivalent: pass a route param or query `?section=saved-drills`.

### 5.4 Back navigation

| Screen | Back target | Label |
|---|---|---|
| Part Detail | My Plans | "My Learning Journey" (with ← arrow) |
| Drill session | Previous screen (Part Detail, Saved Drills, or Home) | Standard back |

### 5.5 Bottom tab bar

Visible on **My Plans** and **Part Detail** (matches web). Drill session screens typically hide tab bar.

---

## 6. UX Notes

### 6.1 Visual design tokens

| Token | Value | Usage |
|---|---|---|
| Primary green | `#22c55e` | Completion checkmarks, bookmark active, loading spinners |
| Green hover/dark | `#16a34a` | Bookmark button pressed state |
| Orange bookmark | `orange-600` / `orange-100` bg | Saved Drills section icon |
| Part badge gradient | `emerald-100 → teal-200` | Part number badge |
| Card radius | `rounded-2xl` (16px) | All cards and collapsible headers |
| Thumbnail radius | `rounded-xl` (12px) | Drill row thumbnails |
| Section spacing | 32px (`space-y-8`) | Between major sections on scroll screens |
| Row spacing | 12px (`space-y-3`) | Between drill rows |

### 6.2 Loading & error states

| Context | Loading | Error |
|---|---|---|
| Saved Drills expand | Centered spinner in panel | Show empty state (no special error UI on web) |
| Part Detail body | Full-page centered spinner | Redirect invalid part; no error card for API failure on web |
| Part progress counts | Show zero counts while loading (drills default to `[]`) | Same |

### 6.3 Empty states summary

| Location | Condition | Message |
|---|---|---|
| Saved Drills subtitle | 0 bookmarks | "No saved drills yet" |
| Saved Drills panel | 0 bookmarks, expanded | "Bookmark drills from your learning journey to find them here." |
| Part card progress | 0 drills in part | "No drills assigned yet" |
| Part Detail topic | 0 drills in topic | "No drills assigned for this topic yet." |
| Home Assigned Drills | 0 active drills | Existing `noDrillsYet` i18n string |

### 6.4 Bookmark behavior

- Bookmarks are **per drill**, not per assignment
- Toggling bookmark calls API then invalidates the learner drills query
- Saved Drills list updates immediately after cache invalidation
- A drill bookmarked from Part Detail appears in Saved Drills on both Home and My Plans
- Removing bookmark from Saved Drills removes it from the list on collapse/expand

### 6.5 Completion indicators

- **Standard drills:** derived from `getDrillStatus()` considering `completedAt`, `status`, `dueDate`
- **Free Talk:** `completedAt != null`
- Checkmark is **informational only** — row remains tappable (navigates to completed summary for drills)

### 6.6 Sort order

Drills within a topic and within Saved Drills use `sortAssignedPlanItems`:

1. Active / incomplete items first
2. Then by due date ascending
3. Completed items last

### 6.7 Subscription / Pro lock

| Screen / component | Gate |
|---|---|
| My Plans | Full page redirect if not subscribed |
| Part Detail | Full page redirect if not subscribed |
| Home Assigned Drills | Individual rows show Pro lock chip; link to subscriptions |
| Saved Drills | No lock on web (relies on parent page access) |
| PlanFreeTalkRow on Home | `locked={!subscribed}` |

### 6.8 Internationalization

| Key | EN string | Where used |
|---|---|---|
| `account.savedDrills` | "Saved Drills" | Section title |
| `account.assignedDrills` | "Assigned Drills" | Home section heading |
| `account.seeAll` | "See all" | Home → My Plans link |
| `account.yourProgress` | "Your Progress" | Home section heading |
| `account.noDrillsYet` | (existing) | Home empty assigned drills |

Additional strings are **hard-coded in English** on web for the Learning Journey UI (Part progress text, empty states, bookmark toasts). Mobile should add i18n keys for all user-visible strings.

### 6.9 Analytics

On drill row navigation from Part Detail / Saved Drills, fire activity tracking:

```typescript
trackActivity("drill", drillId, "started", {
  title, drillTitle, type, assignmentId
});
```

### 6.10 Accessibility

| Element | Requirement |
|---|---|
| Saved Drills header | `accessibilityRole="button"`, `accessibilityState={{ expanded }}` |
| Bookmark button | `accessibilityLabel`: "Save to bookmarks" / "Remove from bookmarks" |
| Completed icon | `accessibilityLabel`: "Completed" |
| Part card | `accessibilityRole="button"`, label includes part number, title, progress |
| Topic headings | `accessibilityRole="header"` |

### 6.11 Performance

- Fetch drills once per screen focus with `limit: 100` (sufficient for journey grouping)
- Consider prefetching drill content on row press-in (web uses `onPrefetch`)
- Catalog is static — bundle with app, no network call

### 6.12 Platform-specific notes

| Concern | Guidance |
|---|---|
| **Safe area** | Pad bottom for tab bar: `max(5.5rem, safeAreaBottom)` on scroll screens |
| **Sticky header** | My Plans and Part Detail use sticky top header with blur — use `stickyHeaderIndices` or animated header on RN |
| **Haptic feedback** | Optional light haptic on bookmark toggle success |
| **Pull to refresh** | Not on web; optional enhancement on mobile for drills list |
| **Toast placement** | Top or bottom per existing mobile toast convention |

### 6.13 Web parity checklist

Use this checklist during QA:

- [ ] My Plans no longer shows Assigned Drills tabs
- [ ] My Plans shows Next Session → Saved Drills → My Learning Journey in order
- [ ] All 4 Part cards always visible
- [ ] Part progress counts match web for same user
- [ ] Part Detail shows all catalog topics, even empty ones
- [ ] Topic sections preserve catalog order
- [ ] Saved Drills collapsed/expanded behavior matches on Home and My Plans
- [ ] `#saved-drills` / deep link auto-expands Saved Drills
- [ ] Home no longer shows Saved Words link
- [ ] Home Saved Drills appears below Your Progress cards
- [ ] Home Assigned Drills still shows max 4 active drills
- [ ] Green checkmark on completed drill rows
- [ ] Bookmark toggle works on PlanDrillRow
- [ ] Invalid part numbers redirect to My Plans
- [ ] Unsubscribed users cannot access My Plans / Part Detail

---

## Backend Integration

> _This section is written by the backend integration agent. See below._

---

### 7. Backend Integration

> Written by the backend integration agent from direct source inspection of the Next.js API routes, server functions, Mongoose schemas, and middleware.

---

#### 7.1 Authentication

All API endpoints require an authenticated session. The mobile app authenticates via **HTTP Bearer token** — a session token string issued by [Better Auth](https://better-auth.dev) when the user signs in.

**How it works (from `src/lib/api/middleware.ts`):**

1. On login, obtain a session token from the auth flow and store it securely on device (e.g., in `expo-secure-store`).
2. On every API request, include the header:
   ```
   Authorization: Bearer <session-token>
   ```
3. The server looks up the token in the `sessions` collection, checks expiry (`expiresAt > now`), and resolves the associated user's `_id` and `role`.
4. If the token is missing, invalid, or expired the server returns **`401 Unauthorized`** immediately — it does **not** fall back to cookies. Renew the session (re-login) when a `401` is received.

**Error responses:**

| HTTP status | `code` field | Meaning |
|---|---|---|
| `401` | `AuthenticationError` | No token / invalid token / session expired |
| `403` | `Forbidden` | Valid user but wrong role (e.g., non-learner hitting a learner-only route) |
| `503` | `ServiceUnavailable` | Auth service temporarily unavailable — retry after a short delay |

**Role required:** `user` (learner). The `my-drills` route is gated with `withRole(["user"], ...)`.

---

#### 7.2 `GET /api/v1/drills/learner/my-drills`

This is the **single endpoint** the mobile app calls to load all data needed for the Learning Journey, Saved Drills, Home Assigned Drills, and My Plans screens.

##### Request

```
GET /api/v1/drills/learner/my-drills
Authorization: Bearer <session-token>
```

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | `100` | Max drill items to return. Use `100` for the learning journey (fetches all assigned drills in one call). |
| `offset` | integer | `0` | Pagination offset. For learning journey, always use `0`. |
| `status` | string | _(none)_ | Optional filter: `pending`, `in-progress`, `completed`, `overdue`, `skipped`. Omit to get all statuses. |

**Recommended call for learning journey:**

```
GET /api/v1/drills/learner/my-drills?limit=100
```

##### Response shape

```jsonc
{
  "data": {
    "drills": [
      // ... array of drill items (see below)
    ],
    "pagination": {
      "total": 42,        // total drills for this learner (including free talk)
      "limit": 100,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

The top-level wrapper is `{ "data": { ... } }` — access the array at `response.data.drills` (web frontend pattern confirmed in `useDrills.ts`).

##### Standard drill item (type ≠ `eklan_free_talk`)

```jsonc
{
  "assignmentId": "664f1a2b3c4d5e6f7a8b9c0d",   // DrillAssignment _id
  "drill": {
    "_id": "664e0a1b2c3d4e5f6a7b8c9d",
    "title": "ICU Emergency Vocabulary",
    "type": "vocabulary",                         // see §7.7 for all types
    "difficulty": "intermediate",
    "date": "2026-07-01T00:00:00.000Z",           // due date
    "duration_days": 7,
    "context": "Practice emergency vocabulary used in an ICU setting.",
    "audio_example_url": null,
    "roleplay_scenes": [],
    "student_character_name": "Student",
    "ai_character_name": "AI",
    "ai_character_names": [],
    "learning_journey_part": 1,                   // ← integer 1–4 (or null/absent)
    "learning_journey_topic": "handling_emergency_critical"  // ← topic slug (or null/absent)
  },
  "assignedBy": "663a0b1c2d3e4f5a6b7c8d9e",      // user _id of assigning admin/tutor
  "assignedAt": "2026-06-01T09:00:00.000Z",
  "dueDate": "2026-07-01T00:00:00.000Z",
  "status": "pending",                            // pending | in-progress | completed | overdue | skipped
  "completedAt": null,                            // ISO string when completed, else null
  "latestAttempt": {
    "score": 85,
    "timeSpent": 420,                             // seconds
    "completedAt": "2026-06-15T14:30:00.000Z",
    "reviewStatus": "reviewed",
    "correctCount": 17,
    "totalCount": 20
  },                                              // null if no attempt yet
  "hasBookmarks": true                            // true if THIS user has bookmarked this drill
}
```

##### Free Talk scenario item (`itemType === "free_talk_scenario"`)

```jsonc
{
  "itemType": "free_talk_scenario",               // ← discriminator field
  "assignmentId": "665a0b1c2d3e4f5a6b7c8d9e",
  "drill": {
    "_id": "665a0b1c2d3e4f5a6b7c8d9e",
    "title": "ICU Emergency Free Talk",
    "type": "eklan_free_talk",
    "scenarioType": "icu_emergency",              // maps to freeTalkScenarioType in catalog
    "date": "2026-07-10T00:00:00.000Z",
    "completionDate": "2026-07-10T00:00:00.000Z"
  },
  "assignedBy": null,
  "assignedAt": "2026-06-10T09:00:00.000Z",
  "dueDate": "2026-07-10T00:00:00.000Z",
  "status": "pending",                            // or "completed"
  "completedAt": null,
  "latestAttempt": null,
  "hasBookmarks": false
}
```

**How to distinguish:** check `item.itemType === "free_talk_scenario"` OR `item.drill?.type === "eklan_free_talk"`.

> **Note:** Free Talk items do **not** carry `learning_journey_part` / `learning_journey_topic` fields. They are matched to the journey catalog via `drill.scenarioType` ↔ `topic.freeTalkScenarioType` (see §7.4).

---

#### 7.3 Client-Side Grouping Algorithm

There is **no server-side grouping endpoint**. The mobile app receives a flat array and groups it locally using the hard-coded catalog (§7.6).

##### Pseudocode

```typescript
import { LEARNING_JOURNEY_PARTS } from './learning-journey.catalog';

type DrillItem = /* item from my-drills response */;

/**
 * Groups a flat drills array by part and topic for the Learning Journey UI.
 * Returns a structure keyed by part number, then topic ID.
 */
function groupDrillsByJourney(
  drills: DrillItem[]
): Map<number, Map<string, DrillItem[]>> {
  const result = new Map<number, Map<string, DrillItem[]>>();

  for (const part of LEARNING_JOURNEY_PARTS) {
    const topicMap = new Map<string, DrillItem[]>();

    for (const topic of part.topics) {
      topicMap.set(topic.id, []);
    }

    result.set(part.part, topicMap);
  }

  for (const item of drills) {
    const isFreeTalk = item.itemType === 'free_talk_scenario';

    if (isFreeTalk) {
      // Match Free Talk items by scenarioType → topic.freeTalkScenarioType
      const scenarioType = item.drill?.scenarioType;
      for (const part of LEARNING_JOURNEY_PARTS) {
        for (const topic of part.topics) {
          if (topic.freeTalkScenarioType === scenarioType) {
            result.get(part.part)?.get(topic.id)?.push(item);
          }
        }
      }
    } else {
      // Match standard drills by learning_journey_part + learning_journey_topic
      const part = item.drill?.learning_journey_part;   // number 1–4 or null
      const topicId = item.drill?.learning_journey_topic; // string slug or null

      if (part != null && topicId != null) {
        result.get(part)?.get(topicId)?.push(item);
      }
      // Drills with no part/topic assigned are excluded from the journey view
    }
  }

  return result;
}

/**
 * Returns all drill items belonging to a specific Part,
 * grouped by topic in catalog order.
 */
function getDrillsForPart(
  groupedDrills: Map<number, Map<string, DrillItem[]>>,
  part: 1 | 2 | 3 | 4
): Array<{ topicId: string; topicTitle: string; items: DrillItem[] }> {
  const partDef = LEARNING_JOURNEY_PARTS.find(p => p.part === part);
  if (!partDef) return [];

  const topicMap = groupedDrills.get(part) ?? new Map();

  return partDef.topics
    .sort((a, b) => a.order - b.order)
    .map(topic => ({
      topicId: topic.id,
      topicTitle: topic.title,
      items: topicMap.get(topic.id) ?? [],
    }));
}
```

**Key rules:**
- Always render **all topics** from the catalog for a Part, even when a topic's `items` array is empty (show "No drills assigned for this topic yet.").
- Topics must appear in `order` field sequence, not insertion order.
- Drills whose `learning_journey_part` / `learning_journey_topic` are `null` or absent are **not** shown in the Journey view (they may still appear in Assigned Drills on Home).

---

#### 7.4 Progress Calculation (Client-Side)

Compute Part-level progress after the drills array is loaded. There is no server-side progress endpoint.

```typescript
type PartProgress = { completed: number; total: number };

/**
 * A drill item is "completed" when:
 *   - status === 'completed', OR
 *   - completedAt is a non-null, non-empty value
 */
function isCompleted(item: DrillItem): boolean {
  return item.status === 'completed' || item.completedAt != null;
}

/**
 * Returns progress for each of the 4 Parts.
 */
function computePartProgress(
  drills: DrillItem[]
): Record<1 | 2 | 3 | 4, PartProgress> {
  const progress: Record<number, PartProgress> = {
    1: { completed: 0, total: 0 },
    2: { completed: 0, total: 0 },
    3: { completed: 0, total: 0 },
    4: { completed: 0, total: 0 },
  };

  for (const item of drills) {
    const isFreeTalk = item.itemType === 'free_talk_scenario';
    let part: number | null = null;

    if (isFreeTalk) {
      // Resolve part from catalog via scenarioType
      const scenarioType = item.drill?.scenarioType;
      for (const p of LEARNING_JOURNEY_PARTS) {
        if (p.topics.some(t => t.freeTalkScenarioType === scenarioType)) {
          part = p.part;
          break;
        }
      }
    } else {
      part = item.drill?.learning_journey_part ?? null;
    }

    if (part != null && part >= 1 && part <= 4) {
      progress[part].total += 1;
      if (isCompleted(item)) {
        progress[part].completed += 1;
      }
    }
  }

  return progress as Record<1 | 2 | 3 | 4, PartProgress>;
}
```

**Display rule on `LearningJourneyPartCard`:**
- `totalCount > 0` → `"{completed} of {total} drills completed"`
- `totalCount === 0` → `"No drills assigned yet"`

---

#### 7.5 Bookmark APIs

##### Create bookmark

```
POST /api/v1/bookmarks
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "drillId": "664e0a1b2c3d4e5f6a7b8c9d",
  "type": "drill",
  "content": "664e0a1b2c3d4e5f6a7b8c9d"
}
```

- `drillId` — MongoDB ObjectId string of the drill document (from `item.drill._id`)
- `type` — must be `"drill"` for drill-level bookmarks
- `content` — set to the same value as `drillId` for drill bookmarks

**Responses:**

| Status | Meaning |
|---|---|
| `201 Created` | Bookmark created. Body: `{ "bookmark": { ... } }` |
| `200 OK` | Bookmark already exists (idempotent). Body: `{ "message": "Already bookmarked", "bookmark": { ... } }` |
| `400 Bad Request` | Validation failed (invalid `drillId` format, missing fields). |
| `401 Unauthorized` | No/invalid token. |

##### Remove bookmark

```
DELETE /api/v1/bookmarks/by-drill/{drillId}
Authorization: Bearer <session-token>
```

- `{drillId}` — path param: MongoDB ObjectId string of the drill

**Responses:**

| Status | Meaning |
|---|---|
| `200 OK` | Bookmark deleted. Body: `{ "message": "Bookmark deleted" }` |
| `404 Not Found` | No bookmark found for this drill + user combination. |
| `400 Bad Request` | Invalid `drillId` format. |
| `401 Unauthorized` | No/invalid token. |

##### `hasBookmarks` field

The `hasBookmarks: boolean` field on each item in `my-drills` tells whether **the authenticated user** has an active drill-type bookmark for that drill. Use this to initialize the bookmark button state without an additional API call.

After a bookmark toggle succeeds, **invalidate the `my-drills` cache** (re-fetch) so `hasBookmarks` stays in sync across all screens.

##### Bookmark interaction flow

```
User taps bookmark button
  │
  ├─ hasBookmarks === false → POST /api/v1/bookmarks
  │                              body: { drillId, type: "drill", content: drillId }
  │
  └─ hasBookmarks === true  → DELETE /api/v1/bookmarks/by-drill/{drillId}

On success:
  → Invalidate / refetch my-drills query
  → Toast feedback (see §4.2 of this spec)

On 409 / "Already bookmarked" (200 with message):
  → Show "Already bookmarked" info toast
  → Still invalidate cache

On error:
  → Toast error; do NOT update local state optimistically without rollback
```

---

#### 7.6 Hard-Coded Journey Catalog

There is **no API endpoint** for the learning journey catalog. The mobile app must bundle the catalog as a local constant. Copy this verbatim and keep it in sync with the server-side file at `src/domain/learning-journey/learning-journey.catalog.ts`.

```typescript
// domain/learning-journey/learning-journey.catalog.ts
// Mirror of server-side catalog — hard-coded, no API fetch required.

export type LearningJourneyPartId = 1 | 2 | 3 | 4;

export type LearningJourneyTopic = {
  id: string;
  title: string;
  order: number;
  /** Matches drill items where item.drill.scenarioType === freeTalkScenarioType */
  freeTalkScenarioType?: string;
};

export type LearningJourneyPart = {
  part: LearningJourneyPartId;
  title: string;
  topics: LearningJourneyTopic[];
};

export const LEARNING_JOURNEY_PARTS: LearningJourneyPart[] = [
  {
    part: 1,
    title: "Communication with Patients",
    topics: [
      { id: "handling_emergency_critical", title: "Handling Emergency/Critical Situation", order: 1, freeTalkScenarioType: "icu_emergency" },
      { id: "conducting_cpr",              title: "Conducting CPR",                        order: 2, freeTalkScenarioType: "cpr" },
      { id: "patient_follow_up",           title: "Follow-up with Patients",               order: 3, freeTalkScenarioType: "patient_follow_up" },
      { id: "admitting_patient",           title: "Admitting a Patient",                   order: 4, freeTalkScenarioType: "admission" },
      { id: "small_talk_patient",          title: "Small Talk with a Patient",             order: 5, freeTalkScenarioType: "small_talk_patient" },
    ],
  },
  {
    part: 2,
    title: "Communication with Colleagues",
    topics: [
      { id: "receiving_handover",    title: "Receiving an Handover",                                order: 1, freeTalkScenarioType: "handover_receive" },
      { id: "giving_handover",       title: "Giving an Handover",                                   order: 2, freeTalkScenarioType: "handover" },
      { id: "declining_request",     title: "Declining a Request and Professionally Saying No",     order: 3, freeTalkScenarioType: "decline_request" },
      { id: "small_talk_colleagues", title: "Small Talk with Colleagues",                           order: 4, freeTalkScenarioType: "small_talk_colleague" },
    ],
  },
  {
    part: 3,
    title: "Communication with Doctors, Families and Friends",
    topics: [
      { id: "providing_updates_doctor",  title: "Providing Updates to a Doctor",               order: 1, freeTalkScenarioType: "phone_doctor" },
      { id: "doctor_rounds",             title: "Going on Rounds with Doctors",                order: 2, freeTalkScenarioType: "doctor_rounds" },
      { id: "answering_family_questions",title: "Answering Families and Friend's Questions",   order: 3, freeTalkScenarioType: "family_questions" },
    ],
  },
  {
    part: 4,
    title: "Bonus Scenarios",
    topics: [
      { id: "phone_colleagues",      title: "Phone Communication with Colleagues",                   order: 1, freeTalkScenarioType: "phone_colleague" },
      { id: "phone_other_departments",title: "Phone Communication with Other Departments",           order: 2, freeTalkScenarioType: "phone_department" },
      { id: "phone_patient_families", title: "Phone Communication with the Patient's Families",      order: 3, freeTalkScenarioType: "phone_family" },
    ],
  },
];
```

> **Keep in sync:** if the backend team modifies `learning-journey.catalog.ts` (adds/renames a part or topic), the mobile app must be updated in the same release. There is no version negotiation mechanism.

---

#### 7.7 Drill Item Data Model Reference

The following table lists the fields on each item returned by `my-drills` that are relevant to the Learning Journey feature. Fields not listed here (e.g. `target_sentences`, `roleplay_scenes`, `matching_pairs`) are drill-content fields used only by the drill session screen.

##### Top-level item fields

| Field | Type | Description |
|---|---|---|
| `assignmentId` | `string` (ObjectId) | Primary key of the `DrillAssignment` document. Used in navigation URLs and for drill completion calls. |
| `drill` | object | Populated drill document (see below). |
| `assignedBy` | `string \| null` | User ID of assigning admin/tutor. `null` for Free Talk scenarios. |
| `assignedAt` | `string` (ISO date) | When the drill was assigned. |
| `dueDate` | `string` (ISO date) | Due/completion date. |
| `status` | `string` | Assignment status: `pending` \| `in-progress` \| `completed` \| `overdue` \| `skipped`. |
| `completedAt` | `string \| null` | ISO timestamp when the learner completed the drill. `null` if not yet completed. Use this **or** `status === 'completed'` as the completion signal. |
| `latestAttempt` | object \| `null` | Most recent attempt summary (score, time, correct/total counts). `null` if no attempt exists. |
| `hasBookmarks` | `boolean` | Whether the authenticated user has bookmarked this drill. Bookmark is per-drill, not per-assignment. |
| `itemType` | `"free_talk_scenario"` \| `undefined` | Present only on Free Talk items. Use this to switch rendering to `PlanFreeTalkRow`. |

##### `drill` sub-object fields (learning journey relevant)

| Field | Type | Description |
|---|---|---|
| `_id` | `string` (ObjectId) | Drill document ID. Used in bookmark API calls and navigation. |
| `title` | `string` | Display title. |
| `type` | `string` | Drill type. Standard values: `vocabulary`, `pronunciation`, `roleplay`, `matching`, `definition`, `summary`, `grammar`, `sentence_writing`, `sentence`, `listening`, `fill_blank`, `key_phrases`. Free Talk: `eklan_free_talk`. |
| `difficulty` | `string` | `beginner` \| `intermediate` \| `advanced`. |
| `date` | `string` (ISO date) | Drill due date (same as assignment `dueDate`). |
| `duration_days` | `number` | Duration in days from assignment date. Used to compute `dueDate` if not present on the item. |
| `context` | `string` | General context/instructions. Optional. |
| `learning_journey_part` | `1 \| 2 \| 3 \| 4 \| null` | **Journey grouping field.** Which of the 4 Parts this drill belongs to. `null`/absent = not in the journey. |
| `learning_journey_topic` | `string \| null` | **Journey grouping field.** Topic slug from the catalog (e.g. `"handling_emergency_critical"`). `null`/absent = not grouped into a topic. Always check in combination with `learning_journey_part`. |
| `scenarioType` | `string` | Free Talk only. Matches `freeTalkScenarioType` in the catalog to resolve Part/Topic placement. |
| `completionDate` | `string \| null` | Free Talk only. ISO date shown as due date. |

##### `latestAttempt` sub-object fields

| Field | Type | Description |
|---|---|---|
| `score` | `number` | Score 0–100. |
| `timeSpent` | `number \| undefined` | Seconds spent on the attempt. |
| `completedAt` | `string \| undefined` | ISO timestamp of attempt completion. |
| `reviewStatus` | `string \| undefined` | Teacher review status (e.g. `reviewed`). |
| `correctCount` | `number \| undefined` | Number of correct answers. |
| `totalCount` | `number \| undefined` | Total questions in the attempt. |

---

#### 7.8 API Error Handling Summary

| HTTP code | Meaning | Recommended action |
|---|---|---|
| `200` | Success | Parse `response.data` |
| `400` | Bad request / validation error | Log and show user-friendly error |
| `401` | Unauthenticated | Redirect to login screen |
| `402` | Pro subscription required (`SubscriptionRequired`) | Redirect to subscription screen |
| `403` | Wrong role | Should not occur for learner accounts in normal flow |
| `404` | Resource not found | Treat as "already removed" for DELETE bookmark |
| `429` | Rate limited | Retry with exponential back-off |
| `503` | Service temporarily unavailable | Retry after 2–5 seconds |
| `5xx` | Server error | Show generic error toast; retry is safe for GET endpoints |

---

#### 7.9 Caching Recommendations

| Data | Suggested stale time | Invalidation trigger |
|---|---|---|
| `my-drills` list | 2 minutes | After drill completion, bookmark toggle, or manual pull-to-refresh |
| Journey catalog | Permanent (static) | App update only |
| Individual drill content | 5 minutes | After drill completion |

Use React Query (already used on web) or a similar cache library. The web frontend fetches `limit: 100` in a single call to populate all journey views. Do the same on mobile — one query, multiple consumers.

---

#### 7.10 Implementation Checklist

- [ ] Store session token securely (`expo-secure-store` or equivalent)
- [ ] Attach `Authorization: Bearer <token>` to every API request
- [ ] Handle `401` → redirect to login
- [ ] Fetch `GET /api/v1/drills/learner/my-drills?limit=100` on screen focus
- [ ] Bundle `LEARNING_JOURNEY_PARTS` catalog locally (no API call)
- [ ] Implement `groupDrillsByJourney()` client-side (§7.3)
- [ ] Implement `computePartProgress()` client-side (§7.4)
- [ ] Implement `isCompleted()` using `status === 'completed' || completedAt != null`
- [ ] POST `/api/v1/bookmarks` when toggling on (body: `{ drillId, type: "drill", content: drillId }`)
- [ ] DELETE `/api/v1/bookmarks/by-drill/{drillId}` when toggling off
- [ ] Invalidate `my-drills` cache after bookmark toggle
- [ ] Handle `"Already bookmarked"` 200 response from bookmark POST (idempotent)
- [ ] Distinguish Free Talk items via `itemType === "free_talk_scenario"` before rendering
- [ ] Match Free Talk items to catalog topics via `drill.scenarioType` ↔ `topic.freeTalkScenarioType`

