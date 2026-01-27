# FCM Notification Body Debug Guide

## What We Fixed

Added the notification title and body to the **data object** in addition to the notification object. This ensures the body is available no matter how Firebase delivers the message.

## Why This Helps

Firebase can deliver messages in different formats:
- **Web foreground:** Via `onMessage()` listener
- **Background:** Via service worker
- **Different SDK versions:** May structure data differently

By including `title` and `body` in the data object, we have a fallback if they're not in the notification object.

---

## Testing & Debugging

### Step 1: Open Browser Console
1. Press `F12` or `Cmd+Option+J`
2. Go to **Console** tab
3. Clear previous logs

### Step 2: Send Test Notification
1. Go to admin dashboard
2. Click **"Test Notification"** button
3. Watch the console

### Step 3: Look for These Logs

**Should see:**
```
FCM Message received: {
  notification: {
    title: "🧪 Test Notification",
    body: "Testing notification - If you see this, FCM is working!"
  },
  data: {
    type: "system_alert",
    notificationId: "...",
    title: "🧪 Test Notification",
    body: "Testing notification - If you see this, FCM is working!",
    testMessage: "This is a test notification from the admin panel",
    ...
  }
}

Processed notification: {
  notificationId: "...",
  type: "system_alert",
  title: "🧪 Test Notification",
  body: "Testing notification - If you see this, FCM is working!",
  ...
}
```

### Step 4: Verify Notification Display

You should now see:
- ✅ Notification popup in bottom-right corner
- ✅ Title visible: "🧪 Test Notification"
- ✅ **Body visible:** "Testing notification - If you see this, FCM is working!"

---

## How The Payload Now Works

### Before (Payload Missing Body in Data)
```javascript
// Message sent to Firebase Admin SDK
{
  notification: {
    title: "Test",
    body: "Message body"  // Body only here
  },
  data: {
    type: "system_alert",
    notificationId: "123"
    // NO body here ❌
  }
}

// Received in client
payload.notification?.body  // ✅ Works (has body)
payload.data?.body          // ❌ undefined
```

### After (Payload Includes Body in Data)
```javascript
// Message sent to Firebase Admin SDK
{
  notification: {
    title: "Test",
    body: "Message body"  // Body here ✅
  },
  data: {
    type: "system_alert",
    notificationId: "123",
    title: "Test",
    body: "Message body"  // Also here ✅
  }
}

// Received in client
payload.notification?.body  // ✅ Works
payload.data?.body          // ✅ Also works (fallback)
```

---

## Code Changes Made

**File: `src/lib/fcm-trigger.ts`**

Added to data object:
```typescript
data: {
  ...payload.data,
  type: payload.type,
  notificationId,
  title: payload.title,        // ← NEW
  body: payload.body,          // ← NEW
  ...(payload.image && { image: payload.image }),
  ...(payload.actionUrl && { actionUrl: payload.actionUrl }),
}
```

**File: `src/hooks/useFCM.ts`**

Improved body extraction:
```typescript
const body = 
  payload.notification?.body ||   // Primary source
  payload.data?.body ||           // Fallback 1
  payload.data?.messageBody ||    // Fallback 2
  "";                             // Default

const title = 
  payload.notification?.title ||  // Primary source
  payload.data?.title ||          // Fallback
  "Notification";                 // Default
```

---

## If Still Not Working

### Check 1: Server Logs
Look at server console when sending notification:
```
Sending test notification to 1 tokens from 1 users
Multicast message sent: { success: 1, failure: 0 }
```

If you see failure count > 0, something's wrong with sending.

### Check 2: FCM Admin SDK
Server should log:
```
✅ Firebase Admin SDK initialized successfully
```

If you see error, check `.env.local` has `FIREBASE_SERVICE_ACCOUNT`.

### Check 3: Browser Console
Should show:
```
FCM Message received: {...}
Processed notification: {...}
```

If not showing, FCM hook isn't receiving the message.

### Check 4: Network Tab
1. DevTools → **Network** tab
2. Filter: `fcm-test`
3. Should see `POST /api/v1/fcm/test-notification` with **200** status
4. Response should show: `{"success": true, "message": "Test notification sent successfully", ...}`

---

## Next Steps

1. ✅ Rebuild: `npm run build` (to verify changes compile)
2. ✅ Restart: `npm run dev`
3. ✅ Test: Send test notification
4. ✅ Check console for the logs above
5. ✅ Verify notification appears with body text

The notification body should now display correctly! 🎉

If you still see "undefined", check the browser console logs to see what structure Firebase is actually sending.
