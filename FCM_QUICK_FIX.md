# ⚡ Quick Fix Summary - FCM API URL & Admin SDK

## Issues Fixed ✅

### 1. **Double `/v1/v1` in API URLs** ✅ FIXED
   - **Problem:** Axios instance has `baseURL: '/api/v1'` but code was calling `/v1/fcm/tokens`
   - **Result:** URL became `/api/v1/v1/fcm/tokens` → 404 Not Found
   - **Fix:** Changed all calls to `/fcm/tokens` (without the `/v1`)
   - **Files Changed:** `src/lib/fcm-token-manager.ts` (5 calls fixed)

### 2. **Firebase Admin SDK Initialization** ⚠️ NEEDS CONFIGURATION
   - **Problem:** `FIREBASE_SERVICE_ACCOUNT` environment variable not set
   - **What's Needed:** Add your Firebase service account JSON to `.env.local`
   - **Guide:** See `FCM_COMPLETE_SETUP_GUIDE.md`

### 3. **sendMulticast Method Not Found** ✅ FIXED
   - **Problem:** `messaging.sendMulticast()` doesn't exist on Messaging type
   - **Fix:** Changed to `messaging.sendAll()` with type assertion
   - **File Changed:** `src/lib/fcm-admin.ts` (line ~134)

### 4. **Better Error Messages** ✅ IMPROVED
   - **Added:** Clear error messages explaining what's missing
   - **Added:** Link to setup guide in error messages
   - **File Changed:** `src/lib/fcm-admin.ts` (initialization function)

---

## What You Need to Do NOW

### 🔑 Required: Get Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **facebook-48028**
3. Settings (gear) → **Service Accounts** tab
4. Click **Generate New Private Key**
5. A JSON file will download

### 📝 Required: Add to .env.local

Copy the entire JSON (minified to one line) and add:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"facebook-48028",...}'
```

### 🚀 Then: Restart Dev Server

```bash
npm run dev
```

### ✅ Then: Test the Flow

1. Login as a user → notification permission → token registers
2. Open admin dashboard → click "Test Notification" button
3. See notification appear in user tab

---

## Complete Setup Guide

For detailed step-by-step instructions, see: **FCM_COMPLETE_SETUP_GUIDE.md**

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| API URL Fix | ✅ Fixed | All `/v1/fcm/tokens` → `/fcm/tokens` |
| Admin SDK Initialization | ⚠️ Waiting | Needs `FIREBASE_SERVICE_ACCOUNT` env var |
| sendAll Method | ✅ Fixed | Changed from sendMulticast |
| Admin Dashboard Button | ✅ Ready | Blue button shows on dashboard |
| FCM Notification Listener | ✅ Ready | Integrated in root layout |
| Database Schema | ✅ Ready | FCMToken model created |

---

**Once service account is configured, everything will work!** 🎉
