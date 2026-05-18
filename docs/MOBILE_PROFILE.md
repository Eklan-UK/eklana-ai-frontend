# Mobile Handoff — Profile

> **Prerequisites**: Read `MOBILE_README.md` first for auth, error envelope, shared types, and stack conventions.

---

## 1. Overview

The Profile section gives the student a view of their identity and learning analytics, plus tools to edit their name, email, and avatar.

The Profile tab contains:
- **Profile screen** — read-only overview: avatar, name, email, plan badge, metrics (pronunciation score, time studied, streak), confidence and pronunciation analytics, subscription plan
- **Edit Profile screen** — editable name and email
- **Change Photo screen** — preset avatars or device camera/gallery upload
- **Delete Account** — accessible from edit screen

---

## 2. Web Routes → Mobile Screens

| Web Route | Mobile Screen | Description |
|-----------|---------------|-------------|
| `/account/profile` | `profile/index.tsx` | Read-only profile view with metrics |
| `/account/profile/edit` | `profile/edit.tsx` | Edit name + email; delete account |
| `/account/profile/photo` | `profile/photo.tsx` | Choose avatar: preset or upload |

> Note: `/profile/photo/capture` and `/profile/photo/record-video` do not exist in the web app — all photo selection is handled on the single `photo` page.

---

## 3. Auth

All endpoints require `Authorization: Bearer <token>`. See `MOBILE_README.md`.

---

## 4. API Endpoints

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| GET | `/users/current` | Yes | — | `{ user: User, profile?: Profile }` | No `code/data` wrapper |
| PATCH | `/users/profile` | Yes | `UpdateProfileBody` (Zod) | `{ code: 'Success', data: { user: User } }` | Edit name / email |
| POST | `/users/avatar` | Yes | `multipart/form-data`, field `avatar` | `{ code: 'Success', data: { avatarUrl, publicId } }` | Upload image from device |
| PATCH | `/users/avatar` | Yes | `{ avatarUrl: string }` | `{ code: 'Success', data: { avatarUrl } }` | Set preset avatar URL |
| DELETE | `/users/current` | Yes | — | `{ code: 'Success', message }` | Soft-deletes account |
| GET | `/pronunciation` | Yes | — | `{ code: 'Success', data: { pronunciation: PronunciationMetrics } }` | Profile pronunciation tile |
| GET | `/drills/learner/my-drills` | Yes | `limit=200` | `{ code: 'Success', data: { drills } }` | Sum `timeSpent` for "time studied" |
| GET | `/users/streak` | Yes | — | `{ code: 'Success', data: StreakData }` | Streak summary |

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

// Server validation (Zod) for PATCH /users/profile
// firstName: optional, 1–50 chars
// lastName: optional, 1–50 chars
// username: optional, 3–50 chars, nullable
// email: optional, valid email format
// phone: optional, nullable
// dateOfBirth: optional, nullable

// PronunciationMetrics (from /pronunciation)
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
  weeklyActivity?: boolean[];   // 7 booleans Mon–Sun
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

The web app determines the plan badge label like this:

```ts
// Hardcoded override — "Pro" for all students with subscriptionPlan
export function getPlanLabel(user: User): string {
  if (user.subscriptionPlan) return 'Pro';       // STUDENT_PLAN_LABEL_OVERRIDE
  if (user.isSubscribed) return 'Subscribed';
  return 'Free';
}
```

Subscription detail lives in `/account/settings/subscriptions` — the profile screen just shows the badge.

---

## 7. Screen Breakdown

### 7.1 Profile Screen (`profile/index.tsx`)

**Data hooks:**

```ts
const { data: me } = useQuery(['user-current'], fetchUserCurrent);
const { data: pronunciation } = useQuery(['pronunciation'], fetchPronunciation);
const { data: streak } = useQuery(['user-streak'], fetchUserStreak);
const { data: drillsData } = useQuery(
  ['learner-drills', { limit: 200 }],
  () => apiClient.get('/drills/learner/my-drills?limit=200').then(r => r.data.data)
);

// Compute time studied
const totalMinutes = drillsData?.drills.reduce(
  (sum, d) => sum + (d.latestAttempt?.timeSpent ?? 0), 0
) ?? 0;
const timeStudiedMins = Math.round(totalMinutes / 60);
```

**UI Layout:**

```
SafeAreaView
└── ScrollView
    ├── Header (title "Profile", settings icon → settings screen)
    ├── AvatarSection
    │   ├── Avatar (circular image, fallback: initials)
    │   ├── Display name
    │   ├── Email
    │   └── Plan badge ("Pro" / "Free")
    ├── StatsTiles (horizontal row)
    │   ├── Bookmarks tile → bookmarks screen
    │   ├── Pronunciation score tile
    │   └── Time studied tile (in minutes)
    ├── ConfidenceCard (ring chart)
    ├── PronunciationCard (ring chart)
    ├── CurrentPlanCard → settings/subscriptions
    └── StreakSection
        ├── Streak count + weekly dot grid
        └── CTA → Practice tab
```

**Avatar fallback logic:**
```ts
function getInitials(user: User): string {
  const first = user.firstName?.[0] ?? '';
  const last = user.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || user.email[0].toUpperCase();
}

// Render:
{user.avatar || user.image
  ? <Image source={{ uri: user.avatar ?? user.image }} style={styles.avatar} />
  : <Text style={styles.initials}>{getInitials(user)}</Text>
}
```

**Navigation from profile:**
- Settings icon → `settings/index`
- Edit avatar → `profile/photo`
- Edit name/email → `profile/edit`
- Bookmarks tile → `bookmarks/index`
- Plan card → `settings/subscriptions`
- Streak CTA → `practice/index`

### 7.2 Edit Profile Screen (`profile/edit.tsx`)

**Display fields:**
- Full name (first + last combined into one text input, split on first space when saving)
- Email input

**Form state:**

```ts
const [displayName, setDisplayName] = useState(
  [user.firstName, user.lastName].filter(Boolean).join(' ')
);
const [email, setEmail] = useState(user.email);
```

**Validation (client-side before sending):**
```ts
function validate() {
  if (!displayName.trim()) return 'Name is required';
  if (!email.includes('@')) return 'Valid email required';
  return null;
}
```

**Save mutation:**
```ts
const updateMutation = useMutation({
  mutationFn: async () => {
    const parts = displayName.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';
    return apiClient.patch('/users/profile', { firstName, lastName, email });
  },
  onSuccess: (res) => {
    queryClient.invalidateQueries(['user-current']);
    // Also update local auth store with new user data
    authStore.setUser(res.data.data.user);
    router.back();
  },
  onError: (err) => Alert.alert('Update failed', extractErrorMessage(err)),
});
```

**Delete account:**
```ts
const deleteMutation = useMutation({
  mutationFn: () => apiClient.delete('/users/current'),
  onSuccess: async () => {
    await authStore.logout();          // clears token, resets store
    router.replace('/auth/login');
  },
});

// Show confirmation alert first
Alert.alert(
  'Delete Account',
  'This cannot be undone. All your data will be deleted.',
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
  ]
);
```

**Navigate to photo:** button/avatar tap → `profile/photo`

### 7.3 Change Photo Screen (`profile/photo.tsx`)

**Three options:**

#### Option A: Preset avatars

```ts
const PRESET_AVATARS: string[] = [
  // 30 DiceBear PNG URLs — copy from web src/app/(student)/account/profile/photo/page.tsx
];

// Save preset
const presetMutation = useMutation({
  mutationFn: (avatarUrl: string) => apiClient.patch('/users/avatar', { avatarUrl }),
  onSuccess: (res) => {
    queryClient.invalidateQueries(['user-current']);
    authStore.setUserAvatar(res.data.data.avatarUrl);
    router.back();
  },
});
```

#### Option B: Camera capture

```ts
import * as ImagePicker from 'expo-image-picker';

async function pickFromCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Camera Permission', 'Please allow camera access in settings.');
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (!result.canceled) await uploadImage(result.assets[0].uri);
}
```

#### Option C: Gallery picker

```ts
async function pickFromGallery() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Gallery Permission', 'Please allow photo library access in settings.');
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (!result.canceled) await uploadImage(result.assets[0].uri);
}
```

#### Upload flow

```ts
async function uploadImage(uri: string) {
  // Validate size (5MB max)
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if ((info as any).size > 5 * 1024 * 1024) {
    Alert.alert('File too large', 'Please choose an image under 5MB.');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', {
    uri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const res = await apiClient.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // Update auth store and query cache
  queryClient.invalidateQueries(['user-current']);
  authStore.setUserAvatar(res.data.data.avatarUrl);
  router.back();
}
```

**Important**: The backend handles Cloudinary upload server-side using secret credentials. The mobile app **never** uploads directly to Cloudinary — it always goes through `POST /users/avatar`. The backend:
1. Reads the multipart buffer
2. Uploads to Cloudinary folder `eklan/users/avatars` with face crop (400×400)
3. Deletes the old Cloudinary asset if one exists
4. Saves `secure_url` to `user.avatar` and `user.image`

---

## 8. Expo Router File Structure

```
app/(student)/profile/
├── index.tsx         ← Profile overview
├── edit.tsx          ← Edit name + email + delete account
└── photo.tsx         ← Choose preset or upload image
```

---

## 9. State Management

```ts
// React Query keys
queryKeys.userCurrent           → invalidate after edit / avatar change
queryKeys.pronunciation         → stale: 5 minutes
queryKeys.userStreak            → stale: 60 seconds
['learner-drills', { limit: 200 }] → shared with My Plan; stale: 60s

// Auth store (Zustand + MMKV)
// After profile update, patch the cached user object to avoid full refetch
authStore.setUser(updatedUser)
authStore.setUserAvatar(avatarUrl)
```

---

## 10. Permissions Required

| Permission | Trigger | Expo API |
|------------|---------|----------|
| Camera | "Take photo" button | `ImagePicker.requestCameraPermissionsAsync()` |
| Media Library | "Choose from gallery" button | `ImagePicker.requestMediaLibraryPermissionsAsync()` |

Request permissions at the moment the button is pressed, not on screen mount.

---

## 11. Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| `avatar` and `image` both null | Show initials circle |
| Edit: server Zod validation fails (400) | Display field-level error messages |
| Upload: file > 5MB | Client-side check before upload |
| Upload: network failure | Show retry alert |
| Delete account: auth call fails | Show error toast; do not log out (user still authenticated) |
| Camera unavailable (simulator) | `ImagePicker.launchCameraAsync` returns `canceled: true` |
| `pronunciation.overallScore` is 0 | Show "—" or "No data yet" |
| `timeStudied` computes to 0 | Show "0 min" — not an error |
| Subscription fields missing | Hide plan badge or show "Free" |

---

## 12. Acceptance Checklist

- [ ] Profile screen loads avatar, name, email, plan badge correctly
- [ ] Initials fallback renders when no avatar URL
- [ ] Pronunciation score, time studied, and streak all load from their respective APIs
- [ ] Confidence and pronunciation ring cards animate correctly
- [ ] Tapping settings icon navigates to Settings tab
- [ ] Edit screen pre-populates name and email
- [ ] Name edit splits correctly into firstName / lastName on save
- [ ] Email change calls `PATCH /users/profile` and updates cache
- [ ] Delete account shows confirmation alert before calling API
- [ ] After delete, user is logged out and redirected to login
- [ ] Photo screen shows 30 preset avatars in a grid
- [ ] Camera capture requests permission, crops 1:1, and uploads via `POST /users/avatar`
- [ ] Gallery pick requests permission, crops 1:1, and uploads
- [ ] Files over 5MB are rejected before upload
- [ ] After avatar change, profile screen reflects the new avatar immediately
- [ ] No Cloudinary credentials on mobile client
