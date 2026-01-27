# FCM Testing Checklist

## ✅ Environment Setup

- [x] Firebase configuration added to `.env.local`
  - NEXT_PUBLIC_FIREBASE_API_KEY
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  - NEXT_PUBLIC_FIREBASE_APP_ID
  - NEXT_PUBLIC_FIREBASE_VAPID_KEY

- [x] MongoDB running locally (or Atlas connection working)

- [x] Service Worker registered
  - Check: `public/sw.js` exists and is configured

## 🚀 Getting FCM Tokens Registered

### Step 1: Start Development Server
```bash
npm run dev
# or
yarn dev
```

The app will be available at `http://localhost:3000`

### Step 2: Create/Login with a User Account

1. **Register a new user** OR **login with existing user**
2. Choose a user that you can easily remember
3. **Important:** Keep this user logged in during testing

### Step 3: Grant Notification Permission

When the app loads:

1. **Browser may prompt for notification permission**
   - This usually appears as a popup from the browser
   - Look for a "Allow" or "Enable" button
   - Click to grant permission

2. **If no prompt appears:**
   - Open DevTools (F12)
   - Look in Console tab for any errors
   - Check if `Notification.permission` is `'denied'`
   - If denied, you may need to reset browser permissions:
     - Click the lock/info icon next to the URL bar
     - Find "Notifications" setting
     - Change from "Deny" to "Allow"
     - Refresh the page

### Step 4: Verify Token Registration

1. **Check Browser Console** (F12 → Console)
   - Look for logs like:
   - ✅ `"FCM token registered successfully"`
   - ✅ `"FCM initialization complete"`

2. **Check LocalStorage**
   - Open DevTools → Application → Local Storage
   - Look for key: `fcm_token_registered_at`
   - Should have a recent timestamp
   - Look for key: `fcm_token_<userId>` with token value

3. **Verify in MongoDB**
   ```bash
   # Connect to MongoDB
   mongosh localhost:27017/eklan-ai
   
   # Check FCM tokens collection
   db.fcmtokens.find({ isActive: true })
   
   # You should see documents like:
   # {
   #   _id: ObjectId(...),
   #   userId: ObjectId(...),
   #   token: "dG...",
   #   deviceInfo: {...},
   #   isActive: true,
   #   registeredAt: ISODate(...),
   #   lastSeenAt: ISODate(...)
   # }
   ```

## 🧪 Testing the Admin Dashboard Button

### Prerequisites
- [x] User is logged in as a regular learner
- [x] FCM token is registered (verified in MongoDB)
- [x] Start dev server: `npm run dev`

### Step 1: Open Two Tabs

**Tab 1 - User Session:**
- URL: `http://localhost:3000`
- Logged in as regular user
- Keep DevTools open (F12 → Console)
- Watch for: `"FCM Message received"`

**Tab 2 - Admin Session:**
- URL: `http://localhost:3000/admin/dashboard`
- Logged in as admin user
- Ready to send test notification

### Step 2: Send Test Notification

In Tab 2 (Admin):
1. Find the **"Test Notification"** button (blue button, top right)
2. Click the button
3. Watch for success/error toast notification
4. Expected success message: `"Test notification sent to X device(s)"`

### Step 3: Verify Notification Received

In Tab 1 (User):
1. Check browser console for: `"FCM Message received"`
2. Look for notification popup in **bottom-right corner**
3. Notification should show:
   - Title: "🧪 Test Notification"
   - Body: "Testing notification - If you see this, FCM is working!"
4. Click notification to dismiss or wait 5 seconds for auto-dismiss

## 🐛 Troubleshooting

### Issue: "No active FCM tokens found"

**Cause:** No users have registered FCM tokens

**Solution:**
1. Make sure user is logged in
2. Check browser console for FCM initialization logs
3. Grant notification permission:
   - Click lock icon next to URL
   - Set Notifications to "Allow"
   - Refresh page
4. Check MongoDB for tokens

### Issue: Notification doesn't appear

**Check 1: Notification Permission**
```javascript
// In browser console:
Notification.permission
// Should return 'granted'
```

**Check 2: Service Worker**
- DevTools → Application → Service Workers
- Should show status: "active and running"
- No errors in console

**Check 3: FCM Initialization**
- DevTools → Console
- Look for logs starting with "FCM" or "[Service Worker]"
- Check for error messages

### Issue: Error in Console During Token Registration

**Common Error:** `"Failed to fetch /v1/fcm/tokens"`

**Solutions:**
1. Check if dev server is running: `npm run dev`
2. Verify API endpoint exists: `/src/app/api/v1/fcm/tokens/route.ts`
3. Check MongoDB connection
4. Look at server console for detailed errors

## 📊 Monitoring FCM Tokens

### Check Active Tokens in MongoDB

```bash
# Count of active tokens
db.fcmtokens.countDocuments({ isActive: true })

# Tokens by user
db.fcmtokens.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: '$userId', count: { $sum: 1 } } }
])

# All active tokens
db.fcmtokens.find({ isActive: true }).pretty()
```

### Check Token Registration History

```bash
# Find tokens registered in last hour
db.fcmtokens.find({
  registeredAt: { 
    $gte: new Date(new Date().getTime() - 60*60*1000)
  }
}).pretty()
```

## ✨ Success Indicators

All of these should be true for a working setup:

- ✅ User can login successfully
- ✅ Browser prompts for notification permission
- ✅ Browser console shows FCM initialization logs
- ✅ LocalStorage contains `fcm_token_*` keys
- ✅ MongoDB has documents in `fcmtokens` collection
- ✅ Admin can click "Test Notification" button
- ✅ Button shows "Sending..." while processing
- ✅ Success toast appears: "Test notification sent to X device(s)"
- ✅ User tab shows notification popup
- ✅ Notification appears in bottom-right corner
- ✅ Clicking notification dismisses it

## 📋 Step-by-Step Testing Flow

```
1. Start dev server
   npm run dev

2. Open http://localhost:3000
   Register/Login as user

3. Grant notification permission
   Browser should prompt

4. Verify token in MongoDB
   db.fcmtokens.find({ isActive: true })

5. Open admin dashboard in new tab
   http://localhost:3000/admin/dashboard

6. Click "Test Notification" button
   Blue button at top right

7. Watch user tab
   Should see notification popup

8. Verify success
   Check console logs, toast message, notification
```

## 🎯 Next Steps After Successful Testing

Once test notifications work:

1. **Integrate business logic triggers**
   - Lessons started → lesson_reminder
   - Assignments assigned → assignment_due
   - Drills completed → drill_completed
   - Achievements unlocked → achievement_unlocked

2. **Add notification preferences**
   - User settings to control which notifications to receive
   - Frequency limits (e.g., max 5 per day)

3. **Monitor in production**
   - Set up Firebase Console monitoring
   - Track delivery success rates
   - Set up alerts for failures

4. **Gather analytics**
   - Track notification clicks
   - Measure user engagement
   - A/B test message content

---

**Last Updated:** January 23, 2026
