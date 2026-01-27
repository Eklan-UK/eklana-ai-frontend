# FCM Architecture Diagrams & Visual Guides

---

## 📐 System Architecture

### Current Architecture (Web Push + Expo)

```
┌───────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATIONS                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐          ┌──────────────────────┐   │
│  │   React Web App      │          │  React Native App    │   │
│  │   (Next.js)          │          │  (Expo)              │   │
│  │                      │          │                      │   │
│  │  Service Worker      │          │  Background Handler  │   │
│  │  Web Push API        │          │  Expo Push Plugin    │   │
│  └──────────────────────┘          └──────────────────────┘   │
│           │                                   │                │
└───────────┼───────────────────────────────────┼────────────────┘
            │                                   │
            ▼                                   ▼
       ┌─────────────┐              ┌──────────────────┐
       │ Web Push    │              │ Expo Push        │
       │ API         │              │ Service          │
       │ (Browser)   │              │ (expo.io)        │
       └─────────────┘              └──────────────────┘
            │                                   │
            └───────────────┬───────────────────┘
                            │
                            ▼
            ┌────────────────────────────────┐
            │  Next.js Backend API Routes    │
            │  /api/v1/notifications/*       │
            └────────────────────────────────┘
                            │
                            ▼
            ┌────────────────────────────────┐
            │   MongoDB Database             │
            │   - Notifications              │
            │   - PushTokens                 │
            │   - User Subscriptions         │
            └────────────────────────────────┘

❌ PROBLEMS:
├─ Two separate systems to maintain
├─ Different token formats
├─ Manual token refresh
├─ Limited notification features
└─ Complex error handling
```

### New Architecture (FCM Only)

```
┌───────────────────────────────────────────────────────────────┐
│                  CLIENT APPLICATIONS                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐          ┌──────────────────────┐   │
│  │   React Web App      │          │  React Native App    │   │
│  │   (Next.js)          │          │  (iOS/Android)       │   │
│  │                      │          │                      │   │
│  │  Firebase SDK        │          │  Firebase SDK        │   │
│  │  Service Worker      │          │  Background Handler  │   │
│  └──────────────────────┘          └──────────────────────┘   │
│           │                                   │                │
│           └───────────────┬───────────────────┘                │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
                            ▼
            ┌────────────────────────────────┐
            │  Firebase Cloud Messaging      │
            │  (Unified Delivery Platform)   │
            │                                │
            │  ✓ Web delivery               │
            │  ✓ Android delivery           │
            │  ✓ iOS delivery               │
            │  ✓ Topic subscriptions        │
            │  ✓ Device groups              │
            │  ✓ Analytics & tracking       │
            └────────────────────────────────┘
                            │
                            ▼
            ┌────────────────────────────────┐
            │  Next.js Backend API Routes    │
            │  /api/v1/notifications/*       │
            │                                │
            │  Firebase Admin SDK            │
            │  - Message sending             │
            │  - Token validation            │
            │  - Topic management            │
            └────────────────────────────────┘
                            │
                            ▼
            ┌────────────────────────────────┐
            │   MongoDB Database             │
            │   - Notifications (in-app)     │
            │   - FCM Tokens                 │
            │   - Topic Subscriptions        │
            └────────────────────────────────┘

✅ BENEFITS:
├─ Single unified platform
├─ Consistent token format
├─ Automatic token refresh
├─ Rich notification features
├─ Built-in analytics
├─ Better error handling
├─ Higher reliability (99.9% SLA)
└─ Easier to maintain
```

---

## 🔄 Message Flow Diagrams

### Web Push Foreground Message

```
Browser with App Open
│
├─ User on website
├─ Service Worker registered
├─ Notification permission granted
│
└─ Server sends Web Push message
   │
   ├─ Service Worker intercepts (background)
   │
   └─ Foreground listener triggers
      │
      ├─ Show toast notification (optional)
      ├─ Update UI state
      └─ User sees notification while using app
```

### Web Push Background Message

```
Browser with App Closed
│
├─ User not on website
├─ Service Worker still registered
├─ Notification permission granted
│
└─ Server sends Web Push message
   │
   ├─ Service Worker activates
   │
   ├─ Show OS notification
   │
   └─ User clicks notification
      │
      ├─ Service Worker notification click handler runs
      ├─ Open app window
      └─ Navigate to appropriate page
```

### FCM Foreground Message (Same as Web Push)

```
App with User Interacting
│
└─ Firebase SDK listening to foreground messages
   │
   ├─ Message arrives while app is open
   │
   ├─ Trigger foreground message handler
   │
   └─ Show in-app notification (toast, banner, etc.)
      │
      └─ User sees notification while using app
```

### FCM Background Message (Same as Web Push)

```
App Running in Background / Closed
│
└─ Firebase Cloud Messaging infrastructure
   │
   ├─ Message arrives
   │
   ├─ Service Worker (web) or Background Handler (mobile) processes it
   │
   ├─ Show OS notification
   │
   └─ User clicks notification
      │
      ├─ App opens (or comes to foreground)
      │
      └─ Navigate to appropriate page
```

---

## 🔐 Security Flow

### Token Registration Flow

```
User Opens App
│
└─ Request Notification Permission
   │
   ├─ Browser shows permission dialog
   │
   └─ User grants permission
      │
      └─ Firebase SDK generates FCM token
         │
         └─ useWebPush hook captures token
            │
            └─ POST /api/v1/notifications/register
               │
               ├─ Authentication Check (withAuth middleware)
               │
               ├─ Validate request body (Zod schema)
               │
               ├─ Create PushToken document
               │
               ├─ Log registration event
               │
               └─ Return 201 Success
                  │
                  └─ Client stores token in state
                     │
                     └─ Notifications enabled ✓
```

### Notification Sending Flow

```
Server sends notification request
│
└─ POST /api/v1/notifications (internal API)
   │
   ├─ Validate payload
   │
   ├─ Create Notification document (for in-app)
   │
   ├─ Fetch user's active FCM tokens
   │
   ├─ sendFCMNotification(tokens, payload)
   │  │
   │  ├─ Split tokens into chunks (500 per chunk)
   │  │
   │  ├─ Build FCM message with proper formatting
   │  │  ├─ Notification (title, body)
   │  │  ├─ Webpush (web-specific)
   │  │  ├─ Android (Android-specific)
   │  │  └─ APNS (iOS-specific)
   │  │
   │  ├─ Send via Firebase Admin SDK
   │  │
   │  └─ Process responses
   │     ├─ Track successful sends
   │     ├─ Track failed sends
   │     └─ Identify invalid tokens
   │
   ├─ Delete invalid tokens from database
   │
   ├─ Update Notification with send status
   │
   └─ Return result with metrics
      │
      └─ {
           success: number,
           failed: number,
           invalidTokens: string[]
         }
```

---

## 📊 Data Model Comparison

### Web Push Token Model (OLD)

```
{
  _id: ObjectId,
  userId: ObjectId,
  platform: 'web',
  token: 'PushSubscription JSON string',
  deviceInfo: {
    userAgent: string
  },
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}

❌ PROBLEMS:
├─ Token is stored as JSON string
├─ Must parse JSON to use
├─ Can't add new fields easily
└─ Tightly coupled to Web Push API
```

### FCM Token Model (NEW)

```
{
  _id: ObjectId,
  userId: ObjectId,
  platform: 'web-fcm' | 'android' | 'ios',
  token: 'FCM registration token string',
  deviceInfo: {
    userAgent: string,
    model: string,
    os: string,
    osVersion: string,
    appVersion: string
  },
  isActive: boolean,
  lastUsedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

✅ IMPROVEMENTS:
├─ Token is simple string
├─ Stores more device info
├─ Easier to query and filter
├─ Flexible for future features
└─ Works across all platforms
```

### Notification Model (Same)

```
{
  _id: ObjectId,
  userId: ObjectId,
  title: string,
  body: string,
  type: string,  // 'achievement', 'reminder', etc.
  data: {
    notificationId: string,
    type: string,
    [key: string]: any
  },
  isRead: boolean,
  readAt: Date,
  pushSentAt: Date,
  pushDelivered: boolean,
  createdAt: Date,
  updatedAt: Date
}

✅ No changes needed!
```

---

## 🔄 Token Lifecycle

### Web Push Token Lifecycle (OLD - Manual)

```
Token Created
│
├─ Valid: 1-7 days
│  └─ Can receive messages
│
├─ Expired?
│  ├─ YES → Returns 410 error
│  │  └─ Must delete from database
│  │
│  └─ NO → Still valid
│
└─ User uninstalls app / clears cookies?
   └─ Token becomes invalid
      └─ Must handle 410 errors
```

### FCM Token Lifecycle (NEW - Automatic)

```
Token Created
│
├─ Valid: 365+ days
│  └─ Can receive messages
│
├─ Automatically refreshed by SDK
│  ├─ SDK handles refresh
│  ├─ New token generated periodically
│  ├─ Old token still works
│  └─ No action needed
│
├─ Invalid scenarios:
│  ├─ User uninstalls app
│  ├─ Device OS version changes
│  ├─ Google Play Services updated
│  └─ Returns error code
│
└─ Backend cleans up invalid tokens
   └─ Automatic on next send attempt
```

---

## 📈 Performance Timeline

### Notification Delivery with Web Push

```
0ms    │ Server sends to Web Push API
       │
50ms   │ Web Push API receives
       │
100ms  │ Device wakes up (if sleeping)
       │
200ms  │ Device downloads message
       │
300ms  │ Service Worker processes
       │
350ms  │ Notification shown to user
       │
       ▼ Total: ~350ms average
       
       Range: 100-1000ms depending on network
```

### Notification Delivery with FCM

```
0ms    │ Server sends to FCM
       │
20ms   │ FCM ingests message
       │
50ms   │ FCM routes to appropriate gateway
       │
80ms   │ Device gateway receives
       │
120ms  │ Device wakes up (if needed)
       │
150ms  │ Device processes message
       │
180ms  │ Service Worker/Handler activates
       │
200ms  │ Notification shown to user
       │
       ▼ Total: ~200ms average
       
       Range: 50-500ms (faster & more reliable)
```

---

## 🎯 Notification Type Routing

### Foreground vs Background Handling

```
Notification Arrives
│
├─ Is app running?
│  │
│  ├─ YES (Foreground)
│  │  │
│  │  ├─ Firebase SDK catches message
│  │  │
│  │  ├─ Trigger foreground listener
│  │  │
│  │  ├─ App decides how to show
│  │  │  ├─ Option 1: Toast notification
│  │  │  ├─ Option 2: Modal dialog
│  │  │  ├─ Option 3: In-app banner
│  │  │  └─ Option 4: Silent (no visual)
│  │  │
│  │  └─ Continue serving user
│  │
│  └─ NO (Background/Closed)
│     │
│     ├─ Service Worker activated
│     │
│     ├─ Show OS notification
│     │  ├─ Icon
│     │  ├─ Title
│     │  ├─ Body
│     │  ├─ Image (optional)
│     │  └─ Actions (optional)
│     │
│     └─ Wait for user interaction
│        │
│        ├─ User clicks notification?
│        │  └─ App opens → Notification handler runs
│        │     └─ Navigate to appropriate page
│        │
│        └─ User dismisses?
│           └─ Notification closed event fires
```

---

## 🔌 API Endpoints Summary

### Web Push Endpoints (OLD)

```
POST   /api/v1/notifications
       - Send notification

GET    /api/v1/notifications
       - List notifications

GET    /api/v1/notifications/vapid-key
       - Get VAPID public key

POST   /api/v1/notifications/register
       - Register Web Push subscription

DELETE /api/v1/notifications/register
       - Unregister subscription
```

### FCM Endpoints (NEW)

```
POST   /api/v1/notifications
       - Send notification (same)

GET    /api/v1/notifications
       - List notifications (same)

POST   /api/v1/notifications/register
       - Register FCM token (same interface)

POST   /api/v1/notifications/unregister
       - Unregister token (separate endpoint)

DEPRECATED:
GET    /api/v1/notifications/vapid-key
       - No longer needed
```

---

## 🚀 Migration Timeline Graph

```
Week 1: Setup & Backend Development
├─ Day 1 (4h):  Firebase setup, Admin SDK
├─ Day 2 (4h):  FCM service implementation
├─ Day 3 (4h):  API routes, testing
└─ Day 4 (2h):  Code review, fixes

Week 2: Frontend Development
├─ Day 1 (3h):  Firebase web SDK, config
├─ Day 2 (3h):  useWebPush hook update
├─ Day 3 (2h):  Provider setup, integration
└─ Day 4 (3h):  Component updates

Week 3: Testing & Deployment
├─ Day 1 (4h):  Unit & integration tests
├─ Day 2 (3h):  E2E tests, edge cases
├─ Day 3 (2h):  Staging deployment
└─ Day 4 (2h):  Production deployment

Week 4: Monitoring & Optimization
├─ Day 1 (2h):  Monitor logs, metrics
├─ Day 2 (2h):  Gradual rollout
├─ Day 3 (1h):  Performance tuning
└─ Day 4 (2h):  Documentation, cleanup

Total: ~47 hours of work
Estimated: 2-3 weeks for careful implementation
```

---

## 📊 Metrics Dashboard

### Key Metrics to Display

```
Real-time Metrics:
├─ Tokens Active
│  └─ Web: 1,250
│  └─ Android: 3,420
│  └─ iOS: 2,180
│
├─ Notifications Sent (24h)
│  └─ Total: 45,320
│  └─ Success: 44,980 (99.3%)
│  └─ Failed: 340 (0.7%)
│
├─ Delivery Time (P95)
│  └─ Average: 250ms
│  └─ Min: 50ms
│  └─ Max: 2.5s
│
├─ Token Cleanup (24h)
│  └─ Invalid: 23
│  └─ Expired: 8
│  └─ Unregistered: 12
│
└─ Errors (24h)
   └─ InvalidToken: 15
   └─ InvalidMessage: 3
   └─ InternalError: 1
```

---

## 🔍 Debugging Flowchart

```
Issue: No notifications received
│
├─ Is token registered?
│  ├─ NO  → Check POST /api/v1/notifications/register
│  │  └─ Check browser console for errors
│  │
│  └─ YES → Continue
│
├─ Is notification permission granted?
│  ├─ NO  → User needs to grant permission
│  │  └─ Show permission request dialog
│  │
│  └─ YES → Continue
│
├─ Is Service Worker registered?
│  ├─ NO  → Check /public/firebase-messaging-sw.js exists
│  │  └─ Check browser DevTools > Application > Service Workers
│  │
│  └─ YES → Continue
│
├─ Is Firebase configured correctly?
│  ├─ NO  → Check NEXT_PUBLIC_FIREBASE_* env vars
│  │  └─ Check Firebase console project ID matches
│  │
│  └─ YES → Continue
│
├─ Is server sending to correct token?
│  ├─ NO  → Check token in database matches
│  │  └─ Check token not marked as inactive
│  │
│  └─ YES → Continue
│
├─ Is Firebase account valid?
│  ├─ NO  → Check Firebase Admin SDK credentials
│  │  └─ Check FIREBASE_PRIVATE_KEY is valid
│  │
│  └─ YES → Continue
│
└─ Check FCM logs
   ├─ Firebase Console > Cloud Messaging
   ├─ Look for delivery failures
   └─ Check error codes
```

---

Status: ✅ Visual guides complete

