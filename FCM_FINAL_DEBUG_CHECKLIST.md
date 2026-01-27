# FCM Body Issue - Final Debug Checklist

## Quick Summary

We've made the following improvements:
1. ✅ Fixed analytics error handling (won't show errors)
2. ✅ Improved body extraction with explicit checks
3. ✅ Added detailed console logging to track the body value through the system

## Action Items

### Step 1: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

Wait for: `○ Ready in XXXms`

### Step 2: Clear Everything
1. **Browser Cache:**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Select "All time"
   - Check: Cookies, Site data, Cached images
   - Click "Clear data"

2. **Browser Console:**
   - Press F12 → Console tab
   - Click trash icon to clear logs

### Step 3: Test Flow
1. **Refresh page:** `Ctrl+F5` or `Cmd+Shift+R`
2. **Login** as a user
3. **Grant notification permission** when prompted
4. **Open admin dashboard:** `/admin/dashboard`
5. **Click "Test Notification" button**

### Step 4: Check Console Logs

You should see these exact logs in the **Browser Console**:

```
=== FCM Message Received ===
Full payload: {notification: {...}, data: {...}}
Notification object: {title: "🧪 Test Notification", body: "Testing notification - If you see this, FCM is working!"}
Data object: {type: "system_alert", notificationId: "...", title: "🧪 Test Notification", body: "Testing notification - If you see this, FCM is working!", ...}

Extracted title: 🧪 Test Notification
Extracted body: Testing notification - If you see this, FCM is working!
Body is empty? false
Body is undefined? false
Body type: string

=== Final Notification Object ===
Title: 🧪 Test Notification
Body: Testing notification - If you see this, FCM is working!
Full: {notificationId: "...", type: "system_alert", title: "🧪 Test Notification", body: "Testing notification - If you see this, FCM is working!", ...}
```

### Step 5: Verify Notification

✅ You should see:
- Notification popup in **bottom-right corner**
- Title: "🧪 Test Notification"
- **Body text visible** (not "undefined")

---

## Troubleshooting

### If body is still undefined:

**Check 1:** Look at the "Extracted body:" line
- If it says `undefined` → problem in extraction
- If it says `""` (empty string) → body not being sent
- If it shows actual text → body is there, issue is in display

**Check 2:** Look at "Body type:"
- Should be `string`
- If `undefined` → something is wrong with extraction

**Check 3:** Look at "Full payload:"
- Expand the `notification` object
- Does it have a `body` property with text?
- Expand the `data` object
- Does it have a `body` property with text?

### If notification doesn't appear at all:

1. Check that user is logged in
2. Check that notification permission was granted
3. Check server console shows: `Multicast message sent: { success: 1, failure: 0 }`
4. Hard refresh: `Ctrl+Shift+R`
5. Try sending again

### If you see "Error logging notification analytics":

✅ This is now **okay** - it's just optional analytics, won't affect notifications

---

## What Changed Today

| File | Change |
|------|--------|
| `src/lib/fcm-trigger.ts` | Made analytics error silent (won't block notifications) |
| `src/hooks/useFCM.ts` | Improved body extraction + added detailed logging |

---

## Success Criteria

- [ ] Console shows "=== FCM Message Received ===" 
- [ ] Console shows "Body is undefined? false"
- [ ] Console shows "Body is empty? false"
- [ ] Console shows actual body text (not "undefined")
- [ ] Notification popup appears with title AND body visible
- [ ] No "undefined" shown in notification

---

## Next: Share Console Logs

**If body is still undefined:**

1. Right-click the console log
2. Select "Copy message"
3. Paste it in your response

This will help identify exactly where the body is being lost.

---

**Try it now!** The improved logging will show us exactly what's happening. 🔍
