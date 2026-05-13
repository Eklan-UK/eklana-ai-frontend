# Mobile Handoff — Home Screen

> **Prerequisites**: Read `MOBILE_README.md` first for auth, error envelope, shared types, and stack conventions.

---

## 1. Overview

The Home screen is the student's daily dashboard. It shows:
- A personalized greeting with the student's first name
- Current learning streak badge
- Notification bell
- Push notification opt-in prompt
- Today's Focus drill card (or "Continue Practice" fallback)
- Four metric cards: Confidence, Pronunciation, Accurate Sentence Usage, Response Speed
- Assigned drills list (up to 4 cards)
- Bottom navigation bar

---

## 2. Web Routes (reference)

| Web path | Role |
|----------|------|
| `/account` | Server-composed Home page |
| `/account/streak` | Full streak detail page |
| `/account/tracker` | Weekly tracker (currently static/placeholder) |
| `/account/daily-focus/[id]` | Deep drill linked from Today's Focus card |
| `/account/notifications` | Full notification list |

---

## 3. Backend Contract

### 3.1 Auth

All endpoints require `Authorization: Bearer <token>`. See `MOBILE_README.md`.

### 3.2 Endpoint Table

| Method | Path | Auth | Query / Body | Response Shape | Notes |
|--------|------|------|-------------|----------------|-------|
| GET | `/users/current` | Yes | — | `{ user: User }` | No `code/data` wrapper. Includes `profile` for `role=user`. |
| GET | `/users/streak` | Yes | — | `{ code: 'Success', data: StreakData }` | |
| GET | `/daily-focus/today` | Yes | — | `{ code, dailyFocus\|null, personalization\|null }` | HTTP 200 even when empty (`code: 'NotFound'`) |
| GET | `/progress/home` | Yes | — | `{ code: 'Success', data: { homeProgress: HomeProgressMetrics } }` | |
| GET | `/confidence` | Yes | — | `{ code: 'Success', data: { confidence: ConfidenceMetrics } }` | |
| GET | `/pronunciation` | Yes | — | `{ code: 'Success', data: { pronunciation: PronunciationMetrics } }` | |
| GET | `/drills/learner/my-drills` | Yes | `limit`, `offset`, `status` | `{ code: 'Success', data: { drills, pagination } }` | Use `limit=4` for home, `limit=100` for full list |
| GET | `/notifications` | Yes | `limit`, `skip`, `unreadOnly` | `{ notifications, unreadCount, pagination }` | No `code/data` wrapper |
| PATCH | `/notifications/:id` | Yes | — | `{ success: true }` | Mark single notification read |
| DELETE | `/notifications/:id` | Yes | — | `{ success: true }` | |
| POST | `/notifications/read-all` | Yes | — | `{ success, markedCount }` | |
| GET | `/notifications/vapid-key` | Public | — | `{ publicKey }` | Web push only — skip on mobile |
| POST | `/notifications/register` | Yes | `{ platform: 'expo', token: string, deviceInfo? }` | `{ success, tokenId }` | Register Expo push token |

### 3.3 Response Types

```ts
// HomeProgressMetrics (from /progress/home)
interface HomeProgressMetrics {
  accurateSentenceUsage: number;   // 0–100 percentage
  responseSpeed: number;           // 0–100 percentage
  sentenceWeeklyChange: number;    // delta vs last week
  speedWeeklyChange: number;
}

// ConfidenceMetrics (from /confidence)
interface ConfidenceMetrics {
  overall: number;                 // 0–100
  history?: { date: string; score: number }[];
}

// PronunciationMetrics (from /pronunciation)
interface PronunciationMetrics {
  overallScore: number;
  history?: { date: string; score: number }[];
}

// StreakData (from /users/streak)
interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
  weeklyActivity?: boolean[];      // 7 booleans, Mon–Sun
}

// DailyFocus (from /daily-focus/today)
interface DailyFocus {
  _id: string;
  title: string;
  type: string;                   // e.g. 'roleplay', 'vocabulary'
  difficulty: string;
  estimatedMinutes?: number;
  questionCount?: number;
}
interface PersonalizationPayload {
  summary?: string;
  tips?: string[];
}
interface DailyFocusTodayResponse {
  code: string;
  dailyFocus: DailyFocus | null;
  personalization: PersonalizationPayload | null;
}

// Notification
interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}
interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: { total: number; limit: number; skip: number };
}

// DrillCard data (from /drills/learner/my-drills)
interface LearnerDrill {
  _id: string;
  title: string;
  type: string;
  difficulty: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  dueDate?: string;
  assignmentId: string;
  latestAttempt?: {
    score?: number;
    timeSpent?: number;
    reviewStatus?: string;
  };
}
```

### 3.4 Parallel fetching strategy

The web app fires all Home queries in parallel on mount. On mobile, do the same with React Query:

```ts
// Fired in parallel — do not await sequentially
useQuery(['user-current'], fetchUserCurrent)
useQuery(['user-streak'], fetchUserStreak)
useQuery(['daily-focus-today'], fetchDailyFocusToday)
useQuery(['home-progress'], fetchHomeProgress)
useQuery(['confidence'], fetchConfidence)
useQuery(['pronunciation'], fetchPronunciation)
useQuery(['learner-drills', { limit: 4 }], () => fetchLearnerDrills({ limit: 4 }))
useQuery(['notifications', { limit: 10 }], () => fetchNotifications({ limit: 10 }))
```

---

## 4. Screen File Layout (Expo Router)

```
app/(student)/home/
├── index.tsx                  ← Main Home screen
├── streak.tsx                 ← Full streak detail (links from badge)
├── tracker.tsx                ← Weekly tracker (static/placeholder)
└── notifications.tsx          ← Full notification list
```

---

## 5. Screen Breakdown

### 5.1 HomeScreen (`home/index.tsx`)

**Composition:**

```
SafeAreaView
└── ScrollView
    ├── HomeGreetingHeader
    │   ├── "Hello {firstName}" text
    │   ├── StreakBadge (navigates → streak.tsx)
    │   └── NotificationBell (sheet or navigates → notifications.tsx)
    ├── PushNotificationPrompt (conditional, dismissible)
    ├── TodaysFocusCard (or ContinuePracticeCard fallback)
    ├── MetricsGrid (2×2)
    │   ├── ConfidenceCard
    │   ├── PronunciationCard
    │   ├── AccurateSentenceCard
    │   └── ResponseSpeedCard
    └── AssignedDrillsSection (up to 4 DrillCards)
```

**Data hooks:**

```ts
const { data: me } = useQuery(['user-current'], fetchUserCurrent);
const { data: streak } = useQuery(['user-streak'], fetchUserStreak);
const { data: dailyFocus } = useQuery(['daily-focus-today'], fetchDailyFocusToday);
const { data: progress } = useQuery(['home-progress'], fetchHomeProgress);
const { data: confidence } = useQuery(['confidence'], fetchConfidence);
const { data: pronunciation } = useQuery(['pronunciation'], fetchPronunciation);
const { data: drillsData } = useQuery(['learner-drills', { limit: 4 }], fetchAssignedDrills);
const { data: notifData } = useQuery(['notifications', { limit: 10 }], fetchNotifications);

const firstName = me?.user?.firstName ?? 'there';
```

**Loading state**: Show skeleton cards for each metric section while queries are loading.

**Empty states**:
- `dailyFocus === null` → Show `ContinuePracticeCard` using first item from `drillsData?.drills`.
- `drillsData?.drills.length === 0` → Show "No drills assigned yet" empty state with CTA to Practice tab.
- `streak?.currentStreak === 0` → StreakBadge shows flame icon with "0".

### 5.2 StreakBadge component

```tsx
interface StreakBadgeProps {
  streak: number;
  onPress: () => void;
}
// Navigates to streak.tsx
```

### 5.3 NotificationBell component

```tsx
interface NotificationBellProps {
  unreadCount: number;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
}
```

On mobile: show a bottom sheet (`@gorhom/bottom-sheet`) with notification list when bell is tapped.

**Mutations:**

```ts
// Mark one read
const markRead = useMutation({
  mutationFn: (id: string) => apiClient.patch(`/notifications/${id}`),
  onSuccess: () => queryClient.invalidateQueries(['notifications']),
});

// Mark all read
const markAllRead = useMutation({
  mutationFn: () => apiClient.post('/notifications/read-all'),
  onSuccess: () => queryClient.invalidateQueries(['notifications']),
});

// Delete
const deleteNotif = useMutation({
  mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
  onSuccess: () => queryClient.invalidateQueries(['notifications']),
});
```

### 5.4 TodaysFocusCard

```tsx
// When dailyFocus is non-null
<Pressable onPress={() => router.push(`/daily-focus/${dailyFocus._id}`)}>
  <Text>{dailyFocus.title}</Text>
  <Text>{dailyFocus.type}</Text>
  <Text>{dailyFocus.difficulty}</Text>
  {dailyFocus.estimatedMinutes && <Text>{dailyFocus.estimatedMinutes} min</Text>}
  {personalization?.summary && <Text>{personalization.summary}</Text>}
</Pressable>
```

### 5.5 MetricCards (Confidence, Pronunciation, AccurateSentence, ResponseSpeed)

Each card is a ring/donut chart showing a percentage with a weekly delta indicator.

```tsx
interface MetricCardProps {
  label: string;
  value: number;         // 0–100
  weeklyChange: number;  // positive = improved
  isLoading: boolean;
}
```

Use `react-native-svg` circular progress or `react-native-reanimated` for the ring animation.

### 5.6 AssignedDrillsSection

```tsx
// Render up to 4 DrillCards
drillsData?.drills.slice(0, 4).map(drill => (
  <DrillCard
    key={drill._id}
    drill={drill}
    onPress={() => router.push(`/my-plan/drills/${drill._id}?assignmentId=${drill.assignmentId}`)}
  />
))
```

### 5.7 Push Notification Setup

On mobile, use Expo push notifications instead of Web Push:

```ts
// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import { apiClient } from './api/axios';

export async function registerExpoPushToken(userId: string) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  await apiClient.post('/notifications/register', {
    platform: 'expo',
    token,
    deviceInfo: { platform: Platform.OS },
  });
}
```

Call this once after login, or lazily from the Home screen on first render.

**Do NOT use VAPID / Web Push on mobile** — that is web-browser specific.

---

## 6. State Management

```ts
// Cache keys and invalidation
queryKeys.userCurrent        → invalidate on profile edit, logout
queryKeys.userStreak         → invalidate after drill completion (score ≥ 70)
queryKeys.homeProgress       → stale after 5 minutes (setStaleTime: 5 * 60_000)
queryKeys.confidence         → stale after 5 minutes
queryKeys.pronunciation      → stale after 5 minutes
queryKeys.dailyFocus         → stale after 30 seconds (matches web ISR revalidate=30)
queryKeys.learnerDrills      → invalidate after drill completion
queryKeys.notifications      → invalidate on mark-read actions
```

---

## 7. Navigation from Home

| Action | Destination |
|--------|-------------|
| Tap streak badge | `streak.tsx` |
| Tap notification bell | Bottom sheet or `notifications.tsx` |
| Tap Today's Focus card | `daily-focus/[id].tsx` |
| Tap assigned drill card | `my-plan/drills/[id].tsx?assignmentId=...` |
| Tap "View sessions" | `practice/index.tsx` (Practice tab) |
| Tap pronunciation card | `profile/index.tsx` (Profile tab) |
| Tap bookmarks | `bookmarks.tsx` |

---

## 8. Performance Notes

- Use `FlashList` for the full notification list (not the bell badge — that's a short array).
- The 4-drill home section is small enough for `FlatList` or plain `map`.
- Wrap MetricCards in `React.memo` — they only re-render when their specific query data changes.
- Use `useDeferredValue` if weekly delta text computation is slow (unlikely — it's arithmetic).
- Prefetch the `daily-focus/[id]` page data when `TodaysFocusCard` mounts.

---

## 9. Edge Cases & Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `/daily-focus/today` returns `code: 'NotFound'` with HTTP 200 | `dailyFocus` is `null` — show `ContinuePracticeCard` |
| Any metric endpoint fails | Show "—" or a greyed-out card; do not crash the whole screen |
| `unreadCount > 99` | Display "99+" on the bell badge |
| Notification permission denied | Skip push registration silently; don't block home load |
| Bearer token missing/expired | Axios interceptor redirects to `/auth/login` |
| `firstName` missing from user | Fallback greeting "Hello!" |

---

## 10. Acceptance Checklist

- [ ] Home screen loads and shows all 6 data sections (greeting, streak, daily focus, 4 metrics, assigned drills)
- [ ] Skeleton/loading states visible during initial fetch
- [ ] Streak badge shows live count; tapping opens streak detail
- [ ] Notification bell shows unread count badge; marking read updates count
- [ ] Today's Focus card navigates to the focus drill
- [ ] Fallback "Continue Practice" shows when no daily focus
- [ ] All 4 metric cards render correctly with ring and weekly delta
- [ ] Assigned drill cards navigate to the drill runner with `assignmentId`
- [ ] Expo push token registered successfully after login
- [ ] 401 from any request redirects to login
- [ ] Empty drill list shows friendly empty state
