# Mobile Handoff — Settings

> **Prerequisites**: Read `MOBILE_README.md` first for auth, error envelope, shared types, and stack conventions.

---

## 1. Overview

The Settings section lets students manage their account, preferences, and app behaviour. It is structured as a hub screen with links to individual sub-screens.

The Settings screen contains:
- Profile header (avatar, name) → shortcut to edit profile
- **Account**: email verification status, change password
- **Preferences**: nationality, interface language, learning goals, notification toggles, lesson settings, theme
- **Support**: help, FAQ, contact, feedback
- **Legal**: terms, privacy policy
- **Subscription** info
- **Logout** button

---

## 2. Web Routes → Mobile Screens

| Web Route | Mobile Screen | Description |
|-----------|---------------|-------------|
| `/account/settings` | `settings/index.tsx` | Hub with profile header + links |
| `/account/settings/password` | `settings/password.tsx` | Change password |
| `/account/settings/nationality` | `settings/nationality.tsx` | Pick nationality |
| `/account/settings/language` | `settings/language.tsx` | Pick interface language |
| `/account/settings/goals` | `settings/goals.tsx` | Select learning goal |
| `/account/settings/notifications` | `settings/notifications.tsx` | Toggle notification preferences |
| `/account/settings/lesson` | `settings/lesson.tsx` | Lesson preferences (accent, voice, speed) |
| `/account/settings/theme` | Inline bottom sheet on hub | Light / Dark / System toggle |
| `/account/settings/subscriptions` | `settings/subscriptions.tsx` | Current plan display |
| `/account/settings/contact` | `settings/contact.tsx` | Contact form |
| `/account/settings/help` | `settings/help.tsx` | Help + feedback |
| `/account/settings/faq` | `settings/faq.tsx` | FAQ accordion |
| `/account/settings/privacy` | `settings/privacy.tsx` | Privacy policy |
| `/account/settings/terms` | `settings/terms.tsx` | Terms of service |

> **Theme** on the web is a bottom sheet opened from the hub. On mobile, implement it inline as a selection list within the hub or its own `settings/theme.tsx` screen.

---

## 3. Auth

All preference and account endpoints require `Authorization: Bearer <token>`. Contact form does NOT require auth. See `MOBILE_README.md`.

---

## 4. Auth Flow (Full Detail for Mobile)

### Login

```ts
// POST /api/v1/auth/sign-in/email (Better Auth)
const res = await fetch(`${API_BASE_URL}/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
// Extract session token from response
// Better Auth returns the session in a cookie on web.
// For mobile, check `data.token` or `data.session.token` — confirm with your backend config.
await secureStore.setItem('session_token', data.token);
```

> **Action required**: Verify with your backend how Better Auth returns the token in the JSON body for non-browser clients. You may need to configure `returnSessionTokenInResponse: true` in Better Auth options or use a custom `/api/v1/auth/login` endpoint that explicitly returns the Bearer token.

### Logout

```ts
// 1. Call server
await apiClient.post('/auth/sign-out');
// 2. Clear local storage
await secureStore.deleteItemAsync('session_token');
// 3. Clear React Query cache
queryClient.clear();
// 4. Navigate to login
router.replace('/auth/login');
```

### Email verification resend

```ts
const res = await apiClient.post('/auth/email/resend-verification');
// Response: { code: 'Success' | 'AlreadyVerified', message }
```

### OAuth (Google / Apple)

On mobile, trigger deep link via `expo-web-browser` and capture the token from the callback URL. The backend OAuth callback URL is `${origin}/auth/callback`. Configure Expo scheme appropriately.

---

## 5. API Endpoints

### Preferences

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/users/current` | Yes | — | `{ user: User, profile?: Profile }` |
| PATCH | `/users/preferences` | Yes | `PreferencesBody` (Zod) | `{ code: 'Success', data: { ...updatedFields } }` |

### Auth / Account

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/auth/email/resend-verification` | Yes (cookie or Bearer) | — | `{ code: 'Success' \| 'AlreadyVerified', message }` |
| POST | `/auth/password/change` | Yes | `{ currentPassword, newPassword }` | `{ code, message }` |
| POST | `/auth/sign-out` | Yes | — | (session cleared) |

### Support / Contact

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/contact` | **No auth** | `{ name, email, subject, message }` | `{ code: 'Success', message }` |
| POST | `/feedback` | Yes | `{ name, rating: 1–5, message }` | `{ code: 'Success', message }` |

### Notifications / FCM

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/notifications/register` | Yes | `{ platform: 'expo', token: string, deviceInfo? }` | `{ success, tokenId }` |
| DELETE | `/notifications/register?token=` | Yes | `token` query param | `{ success }` |
| POST | `/fcm/tokens` | Yes | `{ token, userId?, deviceInfo? }` | `{ success, message }` |
| PUT | `/fcm/tokens` | Yes | `{ oldToken, newToken, userId? }` | `{ success }` |
| DELETE | `/fcm/tokens` | Yes | `{ token, userId? }` | `{ success }` |

---

## 6. Zod Schemas (for client validation before sending)

### PATCH `/users/preferences`

```ts
interface PreferencesBody {
  nationality?: string;
  language?: string;              // language name string (e.g. "English", "Japanese")
  learningGoal?: string;          // single goal ID
  learningGoals?: string[];       // array of goal IDs
  theme?: 'system' | 'light' | 'dark';
  notificationPreferences?: {
    learningReminders: boolean;
    specialOffers: boolean;
    subscriptionExpires: boolean;
  };
  lessonPreferences?: {
    eklanTalks?: boolean;
    chatTranslation?: boolean;
    englishAccent?: string;       // e.g. "british", "american"
    voiceTone?: string;           // e.g. "friendly", "professional"
    speakingSpeed?: string;       // e.g. "slow", "normal", "fast"
  };
}
```

**Validation error response (400):**
```ts
{
  code: 'ValidationError',
  message: 'Validation failed',
  errors: { path: string[]; message: string }[]  // Zod issues
}
```

### POST `/auth/password/change`

No Zod on server (manual checks). Client should validate:
- `currentPassword`: non-empty
- `newPassword`: ≥ 8 chars
- `confirmPassword`: matches `newPassword` (client only)

**Responses:**
```ts
// 200
{ code: 'Success', message: 'Password changed successfully' }

// 400
{ code: 'ValidationError' | 'InvalidPasswordError' | 'NoPasswordError', message: string }

// 404
{ code: 'NotFoundError', message: string }

// 500
{ code: 'ServerError', message: string }
```

### POST `/contact`

```ts
{
  name: string;      // min 1
  email: string;     // valid email
  subject: string;   // min 1
  message: string;   // min 1, max 500
}
```

### POST `/feedback`

```ts
{
  name: string;            // min 1
  rating: number;          // integer 1–5
  message?: string;        // defaults to ''
}
```

---

## 7. TypeScript Types for Settings

```ts
// types/settings.ts

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

export type ThemeValue = 'system' | 'light' | 'dark';

// Learning goal IDs (copy from LEARNING_GOAL_ITEMS in web app)
export type LearningGoalId =
  | 'business_english'
  | 'everyday_conversation'
  | 'travel_english'
  | 'academic_english'
  | 'job_interview'
  | 'pronunciation';
// (verify full list from web app's learner-learning-goals.ts)

// Nationality options — copy NATIONALITY_OPTIONS from web app constants

// Language options
export interface LanguageOption {
  locale: string;   // e.g. 'en', 'ja', 'ko'
  name: string;     // e.g. 'English', 'Japanese'
}
```

---

## 8. Screen Breakdown

### 8.1 Settings Hub (`settings/index.tsx`)

**Data:**
```ts
const { data: me } = useQuery(['user-current'], fetchUserCurrent);
const user = me?.user;
const profile = me?.profile;
```

**Layout:**
```
SafeAreaView
└── ScrollView
    ├── ProfileHeader
    │   ├── Avatar / initials
    │   ├── Display name
    │   └── "Edit Profile" → profile/edit
    ├── Section: Account
    │   ├── Email (with verification badge)
    │   ├── "Resend verification" button (if not verified)
    │   └── "Change Password" → settings/password
    ├── Section: Preferences
    │   ├── Nationality → settings/nationality
    │   ├── Language → settings/language
    │   ├── Learning Goals → settings/goals
    │   ├── Notifications → settings/notifications
    │   ├── Lesson Settings → settings/lesson
    │   └── Theme → settings/theme (or inline sheet)
    ├── Section: Support
    │   ├── Help → settings/help
    │   ├── FAQ → settings/faq
    │   └── Contact → settings/contact
    ├── Section: Legal
    │   ├── Privacy Policy → settings/privacy
    │   └── Terms of Service → settings/terms
    ├── Subscription → settings/subscriptions
    └── Logout button
```

**Logout:**
```ts
async function handleLogout() {
  try {
    await apiClient.post('/auth/sign-out');
  } catch { /* continue even if server call fails */ }
  await secureStore.deleteItemAsync('session_token');
  queryClient.clear();
  router.replace('/auth/login');
}
```

### 8.2 Change Password (`settings/password.tsx`)

```ts
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');

function validate(): string | null {
  if (!currentPassword) return 'Current password is required';
  if (newPassword.length < 8) return 'New password must be at least 8 characters';
  if (newPassword !== confirmPassword) return 'Passwords do not match';
  return null;
}

const mutation = useMutation({
  mutationFn: () => apiClient.post('/auth/password/change', { currentPassword, newPassword }),
  onSuccess: () => {
    Toast.show('Password changed successfully');
    router.back();
  },
  onError: (err) => Toast.show(extractErrorMessage(err), 'error'),
});
```

### 8.3 Nationality (`settings/nationality.tsx`)

```ts
// Load current nationality
const { data: me } = useQuery(['user-current'], fetchUserCurrent);
const [selected, setSelected] = useState(me?.profile?.nationality ?? '');

// Optional: after selecting nationality, offer to also change language
const [showLanguagePrompt, setShowLanguagePrompt] = useState(false);

const mutation = useMutation({
  mutationFn: (payload: { nationality: string; language?: string }) =>
    apiClient.patch('/users/preferences', payload),
  onSuccess: () => {
    queryClient.invalidateQueries(['user-current']);
    router.back();
  },
});
```

Display a searchable `FlatList` of nationality options (copy `NATIONALITY_OPTIONS` from web).

### 8.4 Language (`settings/language.tsx`)

```ts
// Saves the display name of the language, not the locale code
// e.g. { language: "Japanese" } not { language: "ja" }

const mutation = useMutation({
  mutationFn: (language: string) => apiClient.patch('/users/preferences', { language }),
  onSuccess: () => {
    queryClient.invalidateQueries(['user-current']);
    // Also update the local i18n locale
    router.back();
  },
});
```

Show list of supported locales from `SUPPORTED_LOCALES` / `APP_INTERFACE_LANGUAGE_NAMES` (copy from web).

### 8.5 Learning Goals (`settings/goals.tsx`)

```ts
// Single goal selection (last selected wins)
const mutation = useMutation({
  mutationFn: (goalId: string) =>
    apiClient.patch('/users/preferences', {
      learningGoal: goalId,
      learningGoals: [goalId],
    }),
  onSuccess: () => {
    queryClient.invalidateQueries(['user-current']);
    router.back();
  },
});
```

Copy `LEARNING_GOAL_ITEMS` from web app for the display list.

### 8.6 Notification Preferences (`settings/notifications.tsx`)

Three toggle switches:

```ts
const { data: me } = useQuery(['user-current'], fetchUserCurrent);
const prefs = me?.profile?.notificationPreferences ?? {
  learningReminders: true,
  specialOffers: false,
  subscriptionExpires: true,
};

const [local, setLocal] = useState<NotificationPreferences>(prefs);

// Debounced auto-save on toggle change
const mutation = useMutation({
  mutationFn: (prefs: NotificationPreferences) =>
    apiClient.patch('/users/preferences', { notificationPreferences: prefs }),
  onSuccess: () => queryClient.invalidateQueries(['user-current']),
});

function toggle(key: keyof NotificationPreferences) {
  const updated = { ...local, [key]: !local[key] };
  setLocal(updated);
  mutation.mutate(updated);
}
```

Labels (from web):
- `learningReminders` → "Learning Reminders"
- `specialOffers` → "Special Offers"
- `subscriptionExpires` → "Subscription Expiry"

> **Important**: These toggles control **email-style notification preferences** stored on the learner's profile. They are **separate** from Expo push token registration (which is done once at login via `POST /notifications/register`).

### 8.7 Lesson Settings (`settings/lesson.tsx`)

Five settings using pickers/sheets:

```ts
interface LessonPrefs {
  eklanTalks: boolean;          // toggle: AI speaks aloud during lesson
  chatTranslation: boolean;     // toggle: show translations
  englishAccent: string;        // "british" | "american" | etc.
  voiceTone: string;            // "friendly" | "professional" | etc.
  speakingSpeed: string;        // "slow" | "normal" | "fast"
}

// Save incrementally on each change
const mutation = useMutation({
  mutationFn: (lessonPreferences: Partial<LessonPrefs>) =>
    apiClient.patch('/users/preferences', { lessonPreferences }),
  onSuccess: () => queryClient.invalidateQueries(['user-current']),
});
```

### 8.8 Theme (`settings/theme.tsx` or inline sheet)

```ts
type ThemeValue = 'system' | 'light' | 'dark';

// Use your RN theming solution (NativeWind dark mode, Appearance API, etc.)
const mutation = useMutation({
  mutationFn: (theme: ThemeValue) =>
    apiClient.patch('/users/preferences', { theme }),
  onSuccess: () => {
    queryClient.invalidateQueries(['user-current']);
    applyTheme(theme);  // update Appearance.setColorScheme or your theme context
  },
});
```

### 8.9 Subscriptions (`settings/subscriptions.tsx`)

**Read-only** — fetches user data and shows the plan.

```ts
const { data: me } = useQuery(['user-current'], fetchUserCurrent);
const user = me?.user;

const planLabel = getPlanLabel(user);  // see Profile section for implementation

// Display:
// - "Current Plan: Pro" card (or "Free")
// - Static pricing tier grid
// - isSubscribed: true → show expiry date
// - isSubscribed: false → show upgrade CTA
```

No settings API called from this screen — it is purely a display of `user.subscriptionPlan`, `user.isSubscribed`, `user.subscriptionExpiresAt`.

### 8.10 Contact (`settings/contact.tsx`)

```ts
// No auth required
const mutation = useMutation({
  mutationFn: (body: { name: string; email: string; subject: string; message: string }) =>
    fetch(`${API_BASE_URL}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  onSuccess: () => {
    Toast.show('Message sent!');
    clearForm();
  },
  onError: () => Toast.show('Failed to send message. Please try again.', 'error'),
});
```

**Form validation:**
- `name`: required
- `email`: valid email format
- `subject`: required
- `message`: required, max 500 characters (show char counter)

### 8.11 Help (`settings/help.tsx`)

- Static FAQ accordion (same content as FAQ screen)
- "Contact Us" → navigate to `settings/contact`
- Feedback form:

```ts
const feedbackMutation = useMutation({
  mutationFn: (body: { name: string; rating: number; message: string }) =>
    apiClient.post('/feedback', body),
  onSuccess: () => Toast.show('Thanks for your feedback!'),
});
```

Star rating: 1–5. `message` is optional (defaults to `''` on server).

### 8.12 FAQ (`settings/faq.tsx`)

Static accordion — no API. Copy Q&A content from web app `faq/page.tsx`.

### 8.13 Privacy (`settings/privacy.tsx`)

Static policy text — no API. Copy content from web app `privacy/page.tsx`. Render as scrollable text or WebView of the policy URL if hosted externally.

### 8.14 Terms (`settings/terms.tsx`)

Static terms text — no API. Same as Privacy approach.

---

## 9. Push Notification Token Management (Mobile-specific)

On mobile, the Expo push token lifecycle:

```ts
// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from './api/axios';

export async function registerExpoPushToken() {
  if (!Device.isDevice) return; // skip on simulator

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,  // required for EAS builds
  })).data;

  await apiClient.post('/notifications/register', {
    platform: 'expo',
    token,
    deviceInfo: { platform: Platform.OS },
  });

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
}

// Call after login:
// await registerExpoPushToken();
```

**Token refresh** — if the Expo push token changes (rare), call `PUT /fcm/tokens` or simply re-register via `POST /notifications/register` which upserts.

**On logout** — deregister:
```ts
const token = currentToken;  // saved from registration
await apiClient.delete(`/notifications/register?token=${encodeURIComponent(token)}`);
```

---

## 10. Error Envelope (Settings Context)

| Error | Meaning | UI response |
|-------|---------|-------------|
| `ValidationError` (400) | Input failed Zod | Show field errors |
| `InvalidPasswordError` (400) | Wrong current password | Show inline error on current password field |
| `NoPasswordError` (400) | Account uses OAuth (no password set) | "Your account uses social login — password cannot be changed" |
| `AuthenticationError` (401) | Token invalid | Redirect to login |
| `AlreadyVerified` (200 code) | Email already verified | Show info toast |

---

## 11. Expo Router File Structure

```
app/(student)/settings/
├── index.tsx               ← Hub
├── password.tsx            ← Change password
├── nationality.tsx         ← Pick nationality
├── language.tsx            ← Pick language
├── goals.tsx               ← Learning goals
├── notifications.tsx       ← Notification toggles
├── lesson.tsx              ← Lesson preferences
├── theme.tsx               ← Theme picker (or inline on hub)
├── subscriptions.tsx       ← Plan display
├── contact.tsx             ← Contact form
├── help.tsx                ← Help + feedback
├── faq.tsx                 ← FAQ accordion
├── privacy.tsx             ← Privacy policy
└── terms.tsx               ← Terms of service
```

---

## 12. State Management

```ts
// All preference changes invalidate user-current
queryKeys.userCurrent    → invalidate after any PATCH /users/preferences

// Optimistic updates for toggles (notification prefs, lesson prefs)
// Use React Query's optimistic update pattern:
const mutation = useMutation({
  mutationFn: updatePreferences,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['user-current']);
    const prev = queryClient.getQueryData(['user-current']);
    queryClient.setQueryData(['user-current'], (old: any) => ({
      ...old,
      profile: { ...old?.profile, ...newData },
    }));
    return { prev };
  },
  onError: (_, __, ctx) => {
    queryClient.setQueryData(['user-current'], ctx?.prev);
  },
  onSettled: () => queryClient.invalidateQueries(['user-current']),
});
```

---

## 13. Performance Notes

- Settings screens are low-traffic — simple `FlatList` for nationality/language pickers is sufficient.
- FAQ and Privacy/Terms pages can be `ScrollView` with static content.
- Debounce lesson preference saves by 500ms to avoid hammering the API on slider changes.
- Theme changes should apply synchronously (update local state first, then save).

---

## 14. Acceptance Checklist

- [ ] Settings hub loads with profile header (avatar, name)
- [ ] All 13 sub-screens are navigable from the hub
- [ ] Change password validates client-side and shows correct server errors
- [ ] `InvalidPasswordError` and `NoPasswordError` show meaningful messages
- [ ] Nationality picker saves and updates profile
- [ ] Language picker saves display name (not locale code)
- [ ] Learning goal selection sends both `learningGoal` and `learningGoals`
- [ ] Notification toggles save immediately with optimistic UI
- [ ] Lesson preferences save incrementally on each change
- [ ] Theme change applies immediately to app UI
- [ ] Subscriptions screen shows correct plan and expiry date
- [ ] Contact form sends without auth and validates message ≤ 500 chars
- [ ] Feedback form sends star rating (1–5) with auth
- [ ] FAQ, Privacy, Terms render static content correctly
- [ ] Logout clears token, clears cache, navigates to login
- [ ] Expo push token registered after login; deregistered on logout
- [ ] Email verification resend shows success or "already verified" message
