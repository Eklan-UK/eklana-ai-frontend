# FCM Testing Guide

Complete guide to testing Firebase Cloud Messaging (FCM) notifications in the Elkan AI application.

## Table of Contents

1. [Quick Test](#quick-test)
2. [API Testing](#api-testing)
3. [Manual Testing](#manual-testing)
4. [Troubleshooting](#troubleshooting)
5. [Advanced Testing](#advanced-testing)

---

## Quick Test

### Method 1: Using the API Endpoint (Easiest)

The simplest way to test notifications is through the HTTP API endpoint.

**Requirements:**
- Admin session (logged in as admin user)
- Browser with developer tools open

**Steps:**

1. **Login as Admin**
   - Open the app in browser: `http://localhost:3000`
   - Login with admin credentials

2. **Open DevTools**
   - Press `F12` or `Cmd+Option+J` (Mac) / `Ctrl+Shift+J` (Windows)
   - Go to Console tab

3. **Send Test Notification**
   ```bash
   # In terminal
   curl -X POST http://localhost:3000/api/v1/fcm/test-notification \
     -H "Content-Type: application/json"
   ```

4. **Watch for Response**
   - Check browser console for `FCM Message received: ...`
   - Look for notification popup in bottom-right corner
   - If no popup, check browser notification permissions

### Method 2: Using the Shell Script

```bash
# Get your session token from browser cookies, then:
ADMIN_TOKEN=your_session_token_here bash scripts/send-test-notification.sh
```

### Method 3: Using TypeScript Script

```bash
# Make sure MongoDB is running, then:
npx ts-node scripts/send-test-notification.ts
```

---

## API Testing

### Send Test Notification to All Users

**Endpoint:** `POST /api/v1/fcm/test-notification`

**Requirements:**
- Admin authentication
- Valid session cookie

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/v1/fcm/test-notification \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_token"
```

**Response Example:**
```json
{
  "success": true,
  "message": "Test notification sent successfully",
  "notificationId": "notif_1234567890_abc",
  "recipientCount": 5,
  "tokenCount": 8,
  "successCount": 8,
  "failureCount": 0
}
```

### Send Custom Notification

**Endpoint:** `POST /api/v1/fcm/send-notification`

**Request Body:**
```json
{
  "type": "lesson_reminder",
  "recipientId": "user_id_here",
  "title": "Your Custom Notification",
  "body": "This is a test message",
  "actionUrl": "/lessons/123",
  "data": {
    "customKey": "customValue"
  }
}
```

**Example with JavaScript/Fetch:**
```javascript
async function sendNotification() {
  const response = await fetch('/api/v1/fcm/send-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'system_alert',
      recipientId: '507f1f77bcf86cd799439011', // User ID
      title: '🧪 Test Notification',
      body: 'Testing FCM from API',
      actionUrl: '/account',
    }),
  });

  const result = await response.json();
  console.log('Notification sent:', result);
}

sendNotification();
```

---

## Manual Testing

### Setup for Manual Testing

1. **Start the App in Development**
   ```bash
   npm run dev
   # Or
   yarn dev
   ```

2. **Open Two Browser Tabs**
   - Tab 1: Normal app view
   - Tab 2: Admin panel (if available)

3. **Tab 1: User Session**
   - Login as a regular user
   - Open DevTools (F12)
   - Go to Application → Service Workers
   - Verify service worker is registered and active
   - Go to Console tab (watch for logs)

4. **Tab 2: Admin Session**
   - Login as admin in new tab
   - Ready to send test notifications

### Test 1: Foreground Notification

**When app is active (focused):**

1. User is logged in and app is in focus
2. Admin sends test notification
3. Check browser console for: `"FCM Message received"`
4. Look for notification popup in bottom-right corner
5. Verify notification content is correct

**Expected Result:**
- Notification appears in UI (bottom-right corner)
- Console shows message received
- Action button works (if present)

### Test 2: Background Notification

**When app is minimized (not focused):**

1. User is logged in but tab is not focused (minimize or switch tabs)
2. Admin sends test notification
3. Check for browser notification (system notification)
4. Click notification to bring app to foreground
5. Verify notification is displayed

**Expected Result:**
- OS/Browser shows notification
- Clicking notification brings app to focus
- Navigation works correctly

### Test 3: Service Worker

**Test service worker push handling:**

1. Login as user
2. Close the browser completely (force quit)
3. Admin sends notification while browser is closed
4. Reopen browser/app
5. Notification should be visible (if browser caches it)

**Expected Result:**
- Service worker continues running in background
- Messages queued while closed are processed

---

## Troubleshooting

### Issue: "No active FCM tokens found"

**Cause:** No users have registered their FCM tokens yet

**Solution:**
1. Make sure at least one user is logged in
2. Check browser console for FCM initialization logs
3. Verify notification permission is granted:
   - Check browser address bar for notification icon
   - Click and ensure "Allow" is selected
4. Service worker must be registered (check DevTools → Application)

**Debug Steps:**
```javascript
// In browser console, check FCM state:
localStorage.getItem('fcm_token_registered_at')
localStorage.keys() // Look for keys starting with 'fcm_token_'
```

### Issue: Notification doesn't appear

**Cause 1: Notification permission not granted**
```javascript
// Check in browser console:
Notification.permission // Should be 'granted'
```

**Cause 2: Service Worker not registered**
- DevTools → Application → Service Workers
- Should show "active and running"
- Check for errors in console

**Cause 3: Firebase not initialized**
- Check browser console for Firebase errors
- Verify environment variables are set
- Check that `.env.local` has Firebase config

**Solution:**
1. Clear browser cache and cookies
2. Reload page in new incognito window
3. Grant notification permission explicitly
4. Check `FCM_SETUP.md` for configuration

### Issue: "Unauthorized - admin role required"

**Cause:** User sending request is not an admin

**Solution:**
1. Make sure you're logged in as admin
2. Check user role in database:
   ```bash
   # In MongoDB:
   db.users.findOne({email: 'admin@example.com'})
   # Should have role: 'admin'
   ```

### Issue: Token registration fails

**Cause 1: Service Worker not found**
```javascript
// In console:
navigator.serviceWorker.getRegistration()
// Should return registration object, not undefined
```

**Cause 2: HTTPS not available (localhost OK)**
- Push notifications require HTTPS in production
- Localhost works fine for development

**Solution:**
1. Restart dev server: `npm run dev`
2. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Check service worker in DevTools

---

## Advanced Testing

### Load Testing

Test sending notifications to many users:

```bash
# Send notification and monitor response time
for i in {1..10}; do
  time curl -X POST http://localhost:3000/api/v1/fcm/test-notification \
    -H "Content-Type: application/json" \
    -H "Cookie: session=your_token"
done
```

### Testing Specific User

Send notification to specific user:

```javascript
// In browser console as admin
fetch('/api/v1/fcm/send-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'lesson_reminder',
    recipientId: '507f1f77bcf86cd799439011',
    title: 'Test for Specific User',
    body: 'This notification is just for you!',
  }),
})
  .then(r => r.json())
  .then(d => console.log(d));
```

### Testing Different Notification Types

```javascript
const types = [
  'lesson_reminder',
  'assignment_due',
  'achievement_unlocked',
  'gamification_milestone',
  'social_follow',
];

for (const type of types) {
  console.log(`Testing ${type}...`);
  
  fetch('/api/v1/fcm/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      recipientIds: ['user_id'],
      title: `Test: ${type}`,
      body: 'Notification type testing',
    }),
  })
    .then(r => r.json())
    .then(d => console.log(d));
}
```

### Monitoring FCM Tokens

```javascript
// View all FCM tokens in database:
// (Run in MongoDB shell or MongoDB Atlas)

db.fcmtokens.find({
  isActive: true
}).pretty()

// Check token count by user:
db.fcmtokens.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: '$userId', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

### Testing Error Scenarios

**Test with invalid token:**
```bash
curl -X POST http://localhost:3000/api/v1/fcm/send-notification \
  -H "Content-Type: application/json" \
  -H "Cookie: session=invalid_token" \
  -d '{"type":"system_alert", "recipientId":"123"}'
# Should return 403 Unauthorized
```

**Test with missing admin role:**
```bash
# Login as regular user, then:
curl -X POST http://localhost:3000/api/v1/fcm/test-notification
# Should return 403 Unauthorized
```

---

## Checking Logs

### Browser Console Logs

1. Open DevTools → Console
2. Look for logs starting with:
   - `[Service Worker]` - Service worker events
   - `FCM` - Firebase Cloud Messaging events
   - `Message received` - Foreground messages

### Server Logs

1. Watch terminal where `npm run dev` is running
2. Look for:
   - `FCM token registered successfully`
   - `Notification sent successfully`
   - `Error sending FCM notification`

### MongoDB Logs

Check FCM token collection:
```bash
# In MongoDB:
db.fcmtokens.find({ isActive: true }).limit(5)

# Check registration timestamps:
db.fcmtokens.aggregate([
  { $group: { 
    _id: null, 
    count: { $sum: 1 },
    latest: { $max: '$registeredAt' }
  }}
])
```

---

## Testing Checklist

- [ ] Environment variables configured (Firebase config)
- [ ] MongoDB running and accessible
- [ ] Dev server running (`npm run dev`)
- [ ] At least one user logged in
- [ ] Notification permission granted in browser
- [ ] Service worker registered (DevTools → Application)
- [ ] Test notification sent successfully
- [ ] Notification appears in UI
- [ ] Clicking notification works
- [ ] Action URL opens correctly
- [ ] Browser console shows no errors
- [ ] Server console shows success logs

---

## Performance Testing

### Measure notification delivery time:

```javascript
// In browser console:
console.time('notification-delivery');

window.addEventListener('fcm-message', (event) => {
  console.timeEnd('notification-delivery');
});

// Then send notification from admin
```

### Measure token registration time:

```javascript
// Monitor time from app start to token registration:
const startTime = performance.now();

// Wait for FCM to initialize...

const endTime = performance.now();
console.log(`Token registration took ${endTime - startTime}ms`);
```

---

## Next Steps

After successful testing:

1. **Integrate into your app:**
   - Add notification listeners to relevant components
   - Trigger notifications based on user actions
   - Display in-app notification toast

2. **Configure notification preferences:**
   - Allow users to disable certain notification types
   - Set notification frequency limits
   - Add user settings UI

3. **Monitor in production:**
   - Set up alert for failed notifications
   - Log delivery metrics
   - Monitor FCM quota usage

4. **Gather user feedback:**
   - A/B test notification messages
   - Track notification engagement
   - Adjust frequency based on user behavior

---

## Additional Resources

- [FCM_SETUP.md](./FCM_SETUP.md) - Firebase configuration guide
- [FCM_IMPLEMENTATION_COMPLETE.md](./FCM_IMPLEMENTATION_COMPLETE.md) - Implementation details
- [Firebase Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
