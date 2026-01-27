# Push Notification Implementation Analysis

**Project:** Elkan AI - English Learning Platform  
**Date:** January 22, 2026  
**Status:** ✅ Fully Implemented

---

## 📋 Overview

The push notification system is a **multi-platform, unified notification service** that supports:
- 🌐 **Web Push** (browsers via Web Push API)
- 📱 **Expo/React Native** (mobile apps)
- 🔔 **FCM** (Firebase Cloud Messaging - prepared but optional)

The implementation follows a **service-based architecture** with clear separation of concerns and includes both server-side and client-side components.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client-Side (React/Next.js)                  │
├──────────────────────────────────────┬──────────────────────────┤
│  useWebPush Hook                     │  useNotifications Hook   │
│  - Subscribe/Unsubscribe             │  - Fetch notifications   │
│  - Permission handling               │  - Mark as read          │
│  - Service Worker registration       │  - Delete notifications  │
└──────────────────────────────────────┴──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js Routes)                   │
├─────────────────────────────────────────────────────────────────┤
│ GET  /api/v1/notifications                    │ List notifications │
│ POST /api/v1/notifications                    │ Send notification  │
│ GET  /api/v1/notifications/vapid-key          │ Get VAPID key     │
│ POST /api/v1/notifications/register           │ Register token    │
│ DELETE /api/v1/notifications/register         │ Unregister token  │
│ PATCH /api/v1/notifications/[id]              │ Mark as read      │
│ POST /api/v1/notifications/read-all           │ Mark all as read  │
└─────────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Notification Service Layer (Business Logic)        │
├──────────────────────────────────────┬──────────────────────────┤
│  Core Functions:                     │  Push Services:          │
│  - sendNotification()                │  - sendWebPush()         │
│  - sendBatchNotifications()          │  - sendExpoPush()        │
│  - getNotifications()                │  - isWebPushConfigured() │
│  - markAsRead()                      │                          │
│  - registerPushToken()               │                          │
│  - unregisterPushToken()             │                          │
└──────────────────────────────────────┴──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database Models                          │
├──────────────────────────────────────┬──────────────────────────┤
│  Notification Model                  │  PushToken Model         │
│  - userId                            │  - userId                │
│  - title, body                       │  - platform              │
│  - type (8 types)                    │  - token                 │
│  - data (navigation info)            │  - deviceInfo            │
│  - isRead, readAt                    │  - isActive              │
│  - pushSentAt, pushDelivered         │  - lastUsedAt            │
└──────────────────────────────────────┴──────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
├──────────────────────────────────────┬──────────────────────────┤
│  Service Worker (/public/sw.js)      │  Browser APIs            │
│  - Handle push events                │  - Notification API      │
│  - Show notifications                │  - Service Worker API    │
│  - Handle clicks & actions           │  - Push Manager API      │
│  - Deep linking                      │                          │
├──────────────────────────────────────┼──────────────────────────┤
│  Expo Push Service                   │  Web-Push Library        │
│  - exp.host/--/api/v2/push/send      │  - VAPID signing         │
│  - Mobile app push delivery          │  - Subscription mgmt     │
└──────────────────────────────────────┴──────────────────────────┘
```

---

## 📦 Key Components

### 1. **Client-Side Hooks**

#### `useWebPush()` - `/src/hooks/useWebPush.ts`
Manages Web Push subscription lifecycle.

**Features:**
- ✅ Browser support detection (ServiceWorker, PushManager, Notification API)
- ✅ Permission request handling
- ✅ Service worker registration
- ✅ VAPID key fetching
- ✅ Push subscription creation/management
- ✅ Token registration with backend
- ✅ Error handling for Brave Shields and privacy settings
- ✅ Subscription status tracking

**State Management:**
```typescript
{
  isSupported: boolean;      // Device supports Web Push
  isSubscribed: boolean;     // User is subscribed
  permission: NotificationPermission | 'unknown';
  isLoading: boolean;
  error: string | null;
}
```

**Methods:**
- `subscribe()` - Subscribe to push notifications
- `unsubscribe()` - Unsubscribe from push notifications

#### `useNotifications()` - `/src/hooks/useNotifications.ts`
Manages in-app notification retrieval and management.

**Features:**
- ✅ Paginated notification fetching
- ✅ Unread count tracking
- ✅ Mark as read functionality
- ✅ Delete notifications
- ✅ Batch operations (mark all as read)
- ✅ React Query integration with auto-refetch

**Hooks Exported:**
- `useNotifications(options)` - Main query hook
- `useUnreadCount()` - Get unread count
- `useMarkAsRead()` - Mark single notification as read
- `useMarkAllAsRead()` - Mark all as read
- `useDeleteNotification()` - Delete notification
- `useRegisterPushToken()` - Register device token
- `useUnregisterPushToken()` - Unregister device token

### 2. **Service Worker** - `/public/sw.js`

Handles push notifications at the browser level.

**Event Listeners:**
1. **Push Event**
   - Parses incoming push data (JSON or text)
   - Displays system notification with rich content
   - Supports vibration, sound, and badge

2. **Notification Click Event**
   - Closes notification
   - Navigates to appropriate URL/screen
   - Reuses existing window or opens new one
   - Deep linking support

3. **Installation & Activation**
   - Auto-activates new versions (`skipWaiting`)
   - Claims all clients immediately (`claim`)

### 3. **Server-Side Services**

#### Web Push Service - `/src/services/notification/web-push.ts`
```typescript
export async function sendWebPush(
  tokens: Array<{ _id: string; token: string }>,
  payload: WebPushPayload
): Promise<{ success: number; failed: number; invalidTokens: string[] }>
```

**Features:**
- ✅ VAPID key initialization
- ✅ Bulk push sending (parallel)
- ✅ Error handling (410 = expired, 404 = invalid)
- ✅ Automatic token deactivation for invalid subscriptions
- ✅ Returns success/failure metrics

#### Expo Push Service - `/src/services/notification/expo-push.ts`
```typescript
export async function sendExpoPush(
  tokens: Array<{ _id: string; token: string }>,
  payload: { title, body, data?, badge? }
): Promise<{ success: number; failed: number; invalidTokens: string[] }>
```

**Features:**
- ✅ Expo token validation
- ✅ Chunked sending (100 tokens per request)
- ✅ Priority handling (high priority for important notifications)
- ✅ Receipt verification support
- ✅ Automatic token deactivation for invalid tokens

#### Unified Notification Service - `/src/services/notification/index.ts`
```typescript
export async function sendNotification(
  payload: NotificationPayload
): Promise<SendResult>
```

**Features:**
- ✅ Database persistence (stores notification)
- ✅ Multi-platform delivery (Web + Expo in parallel)
- ✅ Platform-specific filtering
- ✅ Token status tracking
- ✅ Last used timestamp updating
- ✅ Batch notification support

### 4. **Data Models**

#### Notification Model - `/src/models/notification.model.ts`
```typescript
{
  userId: ObjectId;
  title: string;
  body: string;
  type: NotificationType;  // 8 types supported
  data: {
    screen?: string;       // Deep linking (e.g., 'DrillDetail')
    resourceId?: string;   // Resource reference
    resourceType?: string; // Resource type (e.g., 'drill')
    url?: string;          // Web navigation URL
  };
  isRead: boolean;
  readAt?: Date;
  pushSentAt?: Date;
  pushDelivered: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Methods:**
- `getUnreadCount(userId)` - Get unread notification count
- `markAsRead(notificationId, userId)` - Mark single notification read
- `markAllAsRead(userId)` - Mark all notifications read

#### PushToken Model - `/src/models/push-token.model.ts`
```typescript
{
  userId: ObjectId;
  platform: 'expo' | 'web' | 'fcm';
  token: string;
  deviceInfo: {
    deviceName?: string;
    osVersion?: string;
    appVersion?: string;
    browser?: string;
  };
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```


**Methods:**
- `registerToken(userId, platform, token, deviceInfo)` - Register/update token
- `deactivateToken(token)` - Mark token as inactive
- `getActiveTokens(userId)` - Get all active tokens
- `getTokensByPlatform(userId, platform)` - Platform-specific tokens

**Indexes:**
- `{ userId: 1, token: 1 }` - Unique constraint (one token per device)
- `{ platform: 1, isActive: 1 }` - Fast platform filtering

### 5. **Notification Types**

```typescript
type NotificationType = 
  | 'drill_assigned'      // Tutor assigns a new drill
  | 'drill_reminder'      // Reminder to practice drill
  | 'drill_reviewed'      // Tutor reviewed drill attempt
  | 'drill_completed'     // User completed drill
  | 'daily_focus'         // Daily focus/goal reminder
  | 'achievement'         // Achievement unlocked
  | 'message'             // Direct message
  | 'tutor_update'        // Tutor profile/status update
  | 'system'              // System-level notifications
```

---

## 🔐 API Endpoints

### Authentication
All endpoints require authenticated user (via `withAuth` middleware)

### Endpoints

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/api/v1/notifications` | List notifications | ✅ | User |
| POST | `/api/v1/notifications` | Create notification | ✅ | Admin |
| GET | `/api/v1/notifications/vapid-key` | Get public VAPID key | ❌ | Public |
| POST | `/api/v1/notifications/register` | Register push token | ✅ | User |
| DELETE | `/api/v1/notifications/register` | Unregister token | ✅ | User |
| PATCH | `/api/v1/notifications/[id]` | Mark as read | ✅ | User |
| POST | `/api/v1/notifications/read-all` | Mark all as read | ✅ | User |

#### GET `/api/v1/notifications`
**Query Parameters:**
- `limit` (number, default: 20) - Results per page
- `skip` (number, default: 0) - Pagination offset
- `unreadOnly` (boolean, default: false) - Only unread

**Response:**
```json
{
  "notifications": [...],
  "unreadCount": 5,
  "pagination": {
    "limit": 20,
    "skip": 0,
    "hasMore": false
  }
}
```

#### POST `/api/v1/notifications`
**Request Body:**
```json
{
  "userId": "user-id",
  "title": "Drill Assigned",
  "body": "Your tutor assigned a new pronunciation drill",
  "type": "drill_assigned",
  "data": {
    "screen": "DrillDetail",
    "resourceId": "drill-123",
    "resourceType": "drill",
    "url": "/account/drills/drill-123"
  }
}
```

#### GET `/api/v1/notifications/vapid-key`
**Response:**
```json
{
  "publicKey": "base64-encoded-vapid-public-key"
}
```

#### POST `/api/v1/notifications/register`
**Request Body:**
```json
{
  "platform": "web",
  "token": "{...JSON stringified PushSubscription...}",
  "deviceInfo": {
    "browser": "Mozilla/5.0..."
  }
}
```

#### DELETE `/api/v1/notifications/register?token={tokenString}`
Unregisters a push token

---

## 🔑 Configuration

### Environment Variables

**Required:**
```bash
# Web Push VAPID Keys (generate with: node scripts/generate-vapid-keys.js)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<base64-encoded-key>
VAPID_PRIVATE_KEY=<base64-encoded-key>

# Support email for push notifications
SUPPORT_EMAIL=support@elkan.com
```

**Optional:**
```bash
# Firebase Cloud Messaging (for future FCM support)
NEXT_FIREBASE_PROJECT_ID=...
NEXT_FIREBASE_API_KEY=...
```

### VAPID Key Generation

```bash
# Generate new VAPID keys
node scripts/generate-vapid-keys.js

# Output:
# 🔑 VAPID Keys Generated Successfully!
# 
# Add these to your .env.local file:
# 
# NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
```

### PWA Manifest Configuration

The `public/manifest.json` includes Web App Manifest required for PWA support:
```json
{
  "name": "eklan AI - English Learning Platform",
  "start_url": "/",
  "display": "standalone",
  "icons": [...]
}
```

---

## 🚀 User Flow: Subscribe to Push Notifications

```
User clicks "Enable Notifications"
    ▼
useWebPush.subscribe() called
    ▼
├─ Check browser support (ServiceWorker, PushManager, Notification)
├─ Request notification permission
├─ Register /public/sw.js service worker
├─ Fetch VAPID public key from /api/v1/notifications/vapid-key
├─ Convert VAPID key to Uint8Array
├─ Subscribe to push manager
│   └─ Returns PushSubscription object
├─ Register subscription with backend
│   └─ POST /api/v1/notifications/register
└─ Update UI state (isSubscribed = true)
```

---

## 🚀 User Flow: Receive Push Notification

### Client-to-Server

```
Admin/Tutor triggers notification action
(e.g., assigns drill to user)
    ▼
POST /api/v1/notifications
    ▼
sendNotification() service
    ▼
├─ Save to Notification collection (for in-app list)
├─ Get user's active tokens (Web + Expo)
└─ Parallel delivery:
   ├─ sendWebPush() → Web Push API
   └─ sendExpoPush() → Expo Push Service
```

### Browser Receives Notification

```
Web Push Service receives encrypted payload
    ▼
Service Worker 'push' event
    ▼
Parse notification data (JSON or text)
    ▼
self.registration.showNotification()
    ▼
├─ Display system notification
├─ Support actions/buttons
└─ Include vibration & sound
    ▼
User clicks notification
    ▼
Service Worker 'notificationclick' event
    ▼
├─ Extract URL from data
├─ Check for existing window
├─ Navigate or open new window
└─ Close notification
```

---

## 📊 Database Relationships

```
User
├─ 1:N → Notification
│        - One user has many notifications
│        - Tracks in-app notification history
└─ 1:N → PushToken
         - One user has many tokens (multiple devices)
         - Tracks where to send push notifications
```

---

## ⚠️ Error Handling

### Client-Side Errors

| Error | Cause | Solution |
|-------|-------|----------|
| No ServiceWorker | Older browser | Use HTTPS + modernize browser |
| No PushManager | Safari limitation | Graceful degradation |
| Permission denied | User blocked notifications | Explain in UI, allow re-enable |
| Push blocked (Brave) | Brave Shields blocking | Guide user to disable shields |
| VAPID key fetch failed | Server misconfiguration | Check VAPID env vars |

### Server-Side Errors

| Status | Meaning | Action |
|--------|---------|--------|
| 410 Gone | Subscription expired | Auto-deactivate token |
| 404 Not Found | Invalid subscription | Auto-deactivate token |
| 5xx Server Error | Expo/Push API down | Log, retry later |
| Invalid Token | Malformed subscription | Skip token, continue |

---

## ✨ Features & Capabilities

### ✅ Implemented

- [x] Multi-platform support (Web, Expo, FCM-ready)
- [x] Service Worker integration
- [x] VAPID key management
- [x] Browser permission handling
- [x] Token registration/unregistration
- [x] Database persistence
- [x] Deep linking support
- [x] Rich notifications (title, body, icon, badge, vibration)
- [x] Notification actions
- [x] In-app notification history
- [x] Unread count tracking
- [x] Mark as read functionality
- [x] Batch notification sending
- [x] Automatic token deactivation for expired tokens
- [x] Device info tracking
- [x] Error handling and logging
- [x] React Query integration

### 🚧 Considerations

- [ ] FCM implementation (prepared, not yet used)
- [ ] Notification scheduling
- [ ] Notification deduplication
- [ ] Analytics/delivery metrics dashboard
- [ ] Notification templates
- [ ] A/B testing for notification content
- [ ] Rate limiting per user
- [ ] Notification preferences per user
- [ ] Sound and vibration preferences

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] Subscribe to push notifications (Chrome)
- [ ] Subscribe to push notifications (Firefox)
- [ ] Subscribe to push notifications (Safari/macOS)
- [ ] Receive push notification while app in background
- [ ] Click push notification → correct screen opens
- [ ] Unsubscribe from push notifications
- [ ] Re-subscribe after unsubscribe
- [ ] Check browser DevTools → Application → Service Workers
- [ ] Verify VAPID key in Network tab
- [ ] Test with expired/invalid tokens
- [ ] Test Brave Shields error handling
- [ ] Check MongoDB → PushToken collection

### Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Full | All features |
| Firefox | ✅ Full | All features |
| Edge | ✅ Full | All features |
| Safari | ⚠️ Limited | macOS/iOS limited |
| Brave | ⚠️ Special | Shields may block |
| IE | ❌ No | Not supported |

---

## 📚 Dependencies

```json
{
  "web-push": "^3.6.7",        // Server-side Web Push
  "next": "16.1.1",             // Framework
  "react": "19.2.3",            // UI Library
  "@tanstack/react-query": "^5.90.16",  // Data fetching
  "next-pwa": "^5.6.0",         // PWA support
  "mongoose": "^9.1.1"          // Database
}
```

---

## 🔍 Code Quality

### Strong Points
✅ **Well-organized service architecture** - Clear separation of concerns  
✅ **Type safety** - Full TypeScript throughout  
✅ **Error handling** - Comprehensive try-catch blocks  
✅ **Logging** - Detailed console logs for debugging  
✅ **Performance** - Parallel requests, chunked sending, token deactivation  
✅ **Database optimization** - Proper indexes on frequently queried fields  

### Areas for Enhancement
⚠️ **Notification retry logic** - Could add exponential backoff  
⚠️ **Rate limiting** - No per-user rate limits implemented  
⚠️ **Metrics** - Could add delivery failure analytics  
⚠️ **User preferences** - No per-user notification settings  
⚠️ **Scheduler** - Could add scheduled notifications  

---

## 🎯 Summary

The push notification system is **production-ready** with:
- ✅ Multi-platform support
- ✅ Robust error handling
- ✅ Database persistence
- ✅ Clear API contracts
- ✅ Type-safe implementation
- ✅ Proper service worker integration

**Ready for production deployment.** Consider the enhancement suggestions for future versions.

---

## 📖 References

- [Web Push API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification)
- [Web-Push Library - npm](https://www.npmjs.com/package/web-push)
- [VAPID - RFC 8292](https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid)
- [Expo Push - Docs](https://docs.expo.dev/push-notifications/overview/)
