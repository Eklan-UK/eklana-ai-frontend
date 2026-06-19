# Mobile Handoff — Shared Conventions

This document defines the conventions that apply to **all** section-specific handoff files. Read this first before implementing any section.

---

## Stack Assumptions

The section files target the following mobile stack. Adjust as needed if your repo differs.

| Layer | Library |
|-------|---------|
| Framework | Expo SDK 50+ with Expo Router (TypeScript) |
| Navigation | Expo Router (file-based) + React Navigation where needed |
| HTTP client | `axios` or `fetch` with Bearer token header |
| Server state | `@tanstack/react-query` v5 |
| Local state | Zustand with MMKV persistence |
| Styling | NativeWind v4 or StyleSheet |
| Animation | `react-native-reanimated` v3 |
| Lists | `@shopify/flash-list` |
| Audio | `expo-av` or `expo-audio` |
| Camera / media | `expo-camera`, `expo-image-picker` |
| Notifications | `expo-notifications` |
| Push tokens | Expo Push via `/api/v1/notifications/register` |

---

## Base URL

```
https://your-backend-domain/api/v1
```

All endpoints in the section files are relative to this base. In development, replace with your local or staging URL. Store it in an env variable:

```ts
// lib/api/config.ts
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://your-domain.com/api/v1';
```

---

## Authentication

### How auth works on the backend

The web app uses **HTTP-only session cookies** (Better Auth). The mobile app must use **Bearer tokens** instead.

The backend `requireAuth` middleware accepts either:
1. `Authorization: Bearer <sessionToken>` — validated against MongoDB `sessions` collection.
2. Cookie session — web only.

**Mobile always uses option 1.**

### Session token lifecycle

| Step | Action |
|------|--------|
| Login | `POST /api/v1/auth/sign-in/email` with `{ email, password }` — returns session cookie on web. For mobile, extract the `token` from the JSON response body. |
| Storage | Store token securely with `expo-secure-store` or MMKV encrypted storage. |
| Attach to requests | `Authorization: Bearer <token>` on every authenticated request. |
| Logout | Call `POST /api/v1/auth/sign-out` (or client-only clear). Clear local token. |
| 401 received | Clear token, redirect to login screen. |

### Axios setup

```ts
// lib/api/axios.ts
import axios from 'axios';
import { getToken, clearToken } from '@/lib/auth-storage';
import { router } from 'expo-router';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await clearToken();
      router.replace('/auth/login');
    }
    return Promise.reject(err);
  }
);
```

### React Query setup

```ts
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error: any) =>
        error?.response?.status !== 401 && failureCount < 2,
    },
  },
});
```

---

## Error Envelope

API responses are **inconsistent** — two patterns are used. Always check both.

### Pattern A — `code + data` (most routes)

```ts
interface ApiResponse<T = unknown> {
  code: 'Success' | 'NotFoundError' | 'ValidationError' | 'AuthenticationError' | 'ServerError' | 'Forbidden';
  message: string;
  data?: T;
  errors?: { path: string[]; message: string }[]; // Zod issues
}
```

### Pattern B — top-level fields (some routes)

```ts
// e.g. GET /users/current → { user: {...} }
// e.g. GET /notifications → { notifications: [], unreadCount: 0, pagination: {} }
```

### Error HTTP codes

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | `ValidationError` | Zod / manual validation failed |
| 401 | `AuthenticationError` | Missing / invalid Bearer token |
| 403 | `Forbidden` | Wrong role |
| 404 | `NotFoundError` | Resource not found |
| 500 | `ServerError` | Unexpected server error |

### Client error handling helper

```ts
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    return (
      data?.message ??
      data?.error ??
      (Array.isArray(data?.errors) ? data.errors[0]?.message : null) ??
      'Something went wrong'
    );
  }
  return 'Something went wrong';
}
```

---

## Shared TypeScript Types

These types appear across multiple sections. Define them once in `src/types/api.ts`.

```ts
// src/types/api.ts

export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data?: T;
  errors?: { path: string[]; message: string }[];
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// User (from GET /users/current)
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

// Profile (learner preferences, returned alongside User)
export interface Profile {
  _id: string;
  userId: string;
  learningGoal?: string;
  learningGoals?: string[];
  nationality?: string;
  language?: string;
  theme?: 'system' | 'light' | 'dark';
  lessonPreferences?: LessonPreferences;
  notificationPreferences?: NotificationPreferences;
}

export interface LessonPreferences {
  eklanTalks?: boolean;
  chatTranslation?: boolean;
  englishAccent?: string;
  voiceTone?: string;
  speakingSpeed?: string;
}

export interface NotificationPreferences {
  learningReminders: boolean;
  specialOffers: boolean;
  subscriptionExpires: boolean;
}

// Streak
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
  weeklyActivity?: boolean[];
}
```

---

## React Query Key Conventions

Use string-array keys consistently:

```ts
// src/lib/query-keys.ts
export const queryKeys = {
  userCurrent: ['user-current'] as const,
  userStreak: ['user-streak'] as const,
  homeProgress: ['home-progress'] as const,
  confidence: ['confidence'] as const,
  pronunciation: ['pronunciation'] as const,
  notifications: (params?: object) => ['notifications', params] as const,
  learnerDrills: (params?: object) => ['learner-drills', params] as const,
  drill: (id: string) => ['drill', id] as const,
  dailyFocus: ['daily-focus-today'] as const,
  pronunciationProblems: (params?: object) => ['pronunciation-problems', params] as const,
  sessionSummaries: (params?: object) => ['session-summaries', params] as const,
  pressureTestSessions: ['pressure-test-sessions'] as const,
  bookmarks: ['bookmarks'] as const,
};
```

---

## Navigation (Expo Router) — Top-Level Layout

```
app/
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
├── (student)/
│   ├── _layout.tsx          ← Bottom tab navigator (5 tabs)
│   ├── home/
│   │   └── index.tsx
│   ├── practice/
│   │   ├── index.tsx
│   │   └── ...              ← See MOBILE_PRACTICE.md
│   ├── my-plan/
│   │   └── index.tsx        ← See MOBILE_MY_PLAN.md
│   ├── profile/
│   │   └── index.tsx        ← See MOBILE_PROFILE.md
│   └── settings/
│       └── index.tsx        ← See MOBILE_SETTINGS.md
```

### Bottom Tab Navigator

```tsx
// app/(student)/_layout.tsx
import { Tabs } from 'expo-router';

export default function StudentLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home/index" options={{ title: 'Home' }} />
      <Tabs.Screen name="practice/index" options={{ title: 'Practice' }} />
      <Tabs.Screen name="my-plan/index" options={{ title: 'My Plan' }} />
      <Tabs.Screen name="profile/index" options={{ title: 'Profile' }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```

---

## Permissions Map

| Feature | Permission | Expo Module |
|---------|------------|-------------|
| AI voice session recording | Microphone | `expo-av` / `Audio.requestPermissionsAsync()` |
| Pronunciation recording | Microphone | `expo-av` |
| Avatar capture (camera) | Camera | `expo-camera` or `expo-image-picker` with camera |
| Avatar from gallery | Media Library | `expo-image-picker` |
| Push notifications | Notifications | `expo-notifications` |

Always request permissions at the moment of first use, not on app launch.

---

## SSE (Server-Sent Events) on Mobile

Several AI endpoints return `text/event-stream` (SSE). React Native's `fetch` does not natively support streaming, so use one of these approaches:

### Option A — `react-native-sse` package

```ts
import EventSource from 'react-native-sse';

const es = new EventSource(`${API_BASE_URL}/ai/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

es.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.text) appendText(data.text);
  if (data.done) es.close();
});
```

### Option B — chunked `fetch` with `ReadableStream`

```ts
const response = await fetch(`${API_BASE_URL}/ai/chat`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const reader = response.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  parseSSEChunks(text).forEach(handleChunk);
}
```

### SSE chunk format

```
data: {"type":"text","content":"Hello"}\n\n
data: {"type":"audio","data":"<base64pcm>"}\n\n
data: {"type":"done"}\n\n
data: {"type":"error","message":"..."}\n\n
```

---

## Audio on Mobile

### Recording

Use `expo-av` `Audio.Recording` or the newer `expo-audio`:

```ts
import { Audio } from 'expo-av';

await Audio.requestPermissionsAsync();
await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY  // outputs m4a/mp4
);
// On stop:
await recording.stopAndUnloadAsync();
const uri = recording.getURI();
// Convert to base64 for API:
const base64 = await FileSystem.readAsStringAsync(uri!, { encoding: 'base64' });
```

**Backend expects:** Base64-encoded audio in `audioBase64` field, or raw blob in `FormData` field `audio`. The web app uses WebM/Opus — the backend (Gemini / SpeechAce) accepts multiple formats; m4a/mp4 works.

### Playback

```ts
const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
await sound.playAsync();
// Always unload on cleanup:
await sound.unloadAsync();
```

For PCM chunks streamed from AI (base64 PCM 16kHz), you'll need to write to a temp file and play with `Audio.Sound` or use a native audio buffer library.

---

## Internationalization

The web app uses `next-intl`. For mobile use `i18n-js`, `expo-localization`, or `react-i18next`. The backend does not localize responses — all translations are client-side.

---

## Development Tips

1. **CORS**: The backend allows same-origin by default. From a device/emulator, set `API_BASE_URL` to your machine's LAN IP or a tunnel (ngrok).
2. **Cookies not needed**: The mobile app should never rely on cookies — always Bearer.
3. **`platform` field**: When calling `POST /api/v1/drills/{id}/complete`, pass `platform: 'ios'` or `platform: 'android'` in the body — the server schema accepts these values and uses them for analytics.
4. **Notifications register**: Use `POST /api/v1/notifications/register` with `{ platform: 'expo', token: expoPushToken }` after obtaining the Expo push token.
