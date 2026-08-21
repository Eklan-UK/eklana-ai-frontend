# Mobile Handoff — Profile

> **Prerequisites**: Read `MOBILE_README.md` first for auth, error envelope, shared types, and stack conventions.

---

## 1. Overview

Profile is a **menu hub**, not an analytics dashboard. Analytics live on **My Progress**.

The Profile flow contains:
- **Profile hub** — avatar, name, email, plan pill; stats triple (Saved / Day streak / Time practiced); menus (My Progress, My Plan, Account Information, Subscription, FAQ, Contact, Feedback sheet, Log Out); gear → Settings
- **My Progress** — streak card, skill levels (scorecard → skill-bands), recent badges, Continue practice
- **Account Information** — photo, full name, email, phone, DOB, nationality, native language
- **Change Photo** — preset avatars or device camera/gallery upload
- **Close Account** — confirmation → `DELETE /users/current` (from Settings, not edit)

---

## 2. Web Routes → Mobile Screens

| Web Route | Mobile Screen | Description |
|-----------|---------------|-------------|
| `/account/profile` | `app/(tabs)/profile.tsx` | Menu hub + stats triple + gear → Settings |
| `/account/progress` | `app/my-progress.tsx` | Streak, skill bands, recent badges, CTA |
| `/account/profile/edit` | `app/edit-profile.tsx` | Account Information (name, email, phone, DOB, nationality, nativeLanguage) |
| `/account/profile/photo` | `profile/photo.tsx` | Choose avatar: preset or upload |
| `/account/settings` | `app/settings.tsx` | Settings hub (see `MOBILE_SETTINGS.md`) |

> Note: `/profile/photo/capture` and `/profile/photo/record-video` do not exist in the web app — all photo selection is handled on the single `photo` page.

Shared skill-band util: web `src/domain/progress/skill-bands.ts` ↔ mobile `utils/skill-bands.ts` (same thresholds).

---

## 3. Auth

All endpoints require `Authorization: Bearer <token>`. See `MOBILE_README.md`.

---

## 4. API Endpoints

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| GET | `/users/current` | Yes | — | `{ user: User, profile?: Profile }` | No `code/data` wrapper |
| PATCH | `/users/profile` | Yes | `UpdateProfileBody` (Zod) | `{ code: 'Success', data: { user: User } }` | Name, email, phone, DOB |
| PATCH | `/users/preferences` | Yes | preferences incl. `nationality`, `nativeLanguage` | profile prefs | Account Info nationality / native language |
| POST | `/users/avatar` | Yes | `multipart/form-data`, field `avatar` | `{ code: 'Success', data: { avatarUrl, publicId } }` | Upload image from device |
| PATCH | `/users/avatar` | Yes | `{ avatarUrl: string }` | `{ code: 'Success', data: { avatarUrl } }` | Set preset avatar URL |
| DELETE | `/users/current` | Yes | — | `{ code: 'Success', message }` | Soft-deletes account (Close Account) |
| GET | `/progress/scorecard` | Yes | — | scorecard metrics 0–100 | Clarity = `pronunciation` |
| GET | `/badges` | Yes | — | badge gallery state | Recent achievements |
| GET | `/bookmarks` | Yes | optional `type` | bookmarks list | Profile **Saved** count |
| GET | `/drills/learner/my-drills` | Yes | `limit=200` | `{ code: 'Success', data: { drills } }` | Sum `timeSpent` for time practiced |
| GET | `/users/streak` | Yes | — | `{ code: 'Success', data: StreakData }` | Streak summary |
| POST | `/feedback` | Yes | `{ name, rating, message }` | success | Feedback sheet from Profile + Settings |

---

## 5. TypeScript Types

```ts
// types/profile.ts

export interface User {
  _id: string;
  firstName: string;
  lastName?: string;
  name?: string;
  username?: string;
  email: string;
  role: 'user' | 'admin' | 'tutor';
  avatar?: string;
  image?: string;
  phone?: string;
  dateOfBirth?: string;
  isSubscribed?: boolean;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  hasProfile?: boolean;
}

export interface Profile {
  _id: string;
  userId: string;
  learningGoal?: string;
  learningGoals?: string[];
  nationality?: string;
  language?: string;
  /** Spoken native language (display name). Distinct from app interface `language`. */
  nativeLanguage?: string;
  theme?: 'system' | 'light' | 'dark';
  lessonPreferences?: LessonPreferences;
  notificationPreferences?: NotificationPreferences;
  status?: string;
}

// PATCH /users/profile — request body
export interface UpdateProfileBody {
  firstName?: string;    // min 1, max 50
  lastName?: string;     // min 1, max 50
  username?: string | null; // min 3, max 50, nullable
  email?: string;        // valid email
  phone?: string | null;
  dateOfBirth?: string | null;
}

// Skill bands (shared util) — score 0–100
// <40 Emerging → Learner@40; <60 Developing → Skilled@60;
// <75 Effective → Advanced@75; <90 Confident → Mastery@90; else Authoritative
// Overall badge from 4-metric average: <40 Learner, <75 Skilled, <90 Advanced, else Mastery
// 10-tick bar: round(score / 10)

// PronunciationMetrics (legacy /pronunciation — prefer scorecard for My Progress)
export interface PronunciationMetrics {
  learnerId: string;
  overallScore: number;         // 0–100
  history?: { date: string; score: number }[];
}

// StreakData (from /users/streak)
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
  weeklyActivity?: Array<{ date: string; completed: boolean }>;
}

// Avatar upload response
export interface AvatarResponse {
  code: string;
  message: string;
  data: {
    avatarUrl: string;
    publicId?: string;
  };
}
```

---

## 6. Plan Label Logic

Use `planTitleFromUser` / subscription fields from `GET /users/current`:

```ts
export function planTitleFromUser(user: User | null | undefined): string {
  if (!user) return '—';
  const plan = (user.subscriptionPlan || 'free').toLowerCase();
  if (plan === 'premium' || user.isSubscribed === true) return 'Pro';
  return 'Free';
}
```

Subscription detail lives in `/account/settings/subscriptions` — the profile hub shows the Pro/Free pill and a Subscription menu row.

---

## 7. Screen Breakdown

### 7.1 Profile hub (`profile` tab)

**Data hooks:** bookmarks (all types), streak, learner time studied, `users/current`.

**UI Layout:**

```
Header (Profile + gear → Settings)
Avatar + camera badge → photo
Name / email / Pro|Free pill
Stats triple: Saved → bookmarks | Day streak → streak | Time practiced
Menus:
  My Progress → /account/progress
  My Plan → Plan tab
  Account Information → edit
  Subscription → settings/subscriptions
  FAQ / Contact / Feedback sheet
  Log Out
```

### 7.2 My Progress (`/account/progress`)

Stats triple (same sources), streak card (weekly dots + link to streak screen), skill-level card (`useProgressScorecard` + `getSkillBand` / `SkillLevelRow`), recent unlocked badges (`useBadges`), Continue practice → Practice tab.

### 7.3 Account Information (`profile/edit`)

Editable: photo shortcut, full name, email, phone, date of birth, nationality (full country list), native language (`LANGUAGE_OPTIONS`). Save calls `PATCH /users/profile` then `PATCH /users/preferences` for nationality / nativeLanguage. Close Account is on Settings, not this screen.

### 7.4 Bookmarks (Saved count)

Profile **Saved** uses `GET /api/v1/bookmarks` (all types) for the count and links to `/account/bookmarks`.

Word/sentence practice bookmarks and Saved Drills remain on the bookmarks screen — see existing bookmarks handoff. Do not use bookmarks alone for Saved Drills list UI.

### 7.5 Change Photo Screen (`profile/photo`)

Unchanged: preset avatars, camera, gallery → `POST /users/avatar` or `PATCH /users/avatar`. Backend handles Cloudinary; mobile never uploads directly to Cloudinary.

---

## 8. Expo Router File Structure (target IA)

```
app/(tabs)/profile.tsx     ← Profile menu hub
app/my-progress.tsx        ← My Progress
app/edit-profile.tsx       ← Account Information
app/settings.tsx           ← Settings hub
profile/photo.tsx          ← Avatar picker
```

---

## 9. State Management

```ts
queryKeys: user-current, user-streak, bookmarks, progress-scorecard, badges
Invalidate user-current after profile / preferences / avatar changes
```

---

## 10. Permissions Required

| Permission | Trigger | Expo API |
|------------|---------|----------|
| Camera | "Take photo" | `ImagePicker.requestCameraPermissionsAsync()` |
| Media Library | "Choose from gallery" | `ImagePicker.requestMediaLibraryPermissionsAsync()` |

Request at button press, not on mount.

---

## 11. Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| No avatar | Initials circle |
| Scorecard empty / zero | Show 0% bands / Emerging |
| No unlocked badges | Empty copy on My Progress |
| Close account fails | Toast; stay signed in |
| Time practiced 0 | Show `0m` |

---

## 12. Acceptance Checklist

- [ ] Profile hub shows stats triple + menu rows; gear opens Settings
- [ ] My Progress shows streak, skill bands from scorecard, recent badges, Continue practice
- [ ] Account Information saves phone, DOB, nationality, nativeLanguage
- [ ] Feedback sheet opens from Profile
- [ ] Log Out works from Profile
- [ ] Close Account lives on Settings (not edit)
- [ ] Photo flow unchanged
