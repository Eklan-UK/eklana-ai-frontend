# FCM Implementation - Quick Start & Deployment Guide

**Fast-track guide for migrating to Firebase Cloud Messaging**

---

## ⚡ 5-Minute Setup

### Step 1: Create Firebase Project

```bash
# 1. Go to https://console.firebase.google.com
# 2. Click "Create a new project"
# 3. Name it "Elkan AI"
# 4. Click "Continue"
# 5. Disable Google Analytics (optional)
# 6. Click "Create project"
```

### Step 2: Get Web Configuration

```bash
# In Firebase Console:
# 1. Go to Project Settings (gear icon)
# 2. Go to "Your apps" section
# 3. Click "Web" icon to create web app
# 4. Copy the config object
# 5. Save in environment variables (see below)
```

### Step 3: Generate Service Account Key

```bash
# In Firebase Console:
# 1. Go to Project Settings
# 2. Go to "Service Accounts" tab
# 3. Click "Generate New Private Key"
# 4. Save the JSON file
# 5. Extract credentials for environment variables
```

### Step 4: Environment Variables

Create `.env.local`:

```bash
# Web SDK (public - safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=elkan-ai.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=elkan-ai-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=elkan-ai-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456

# Admin SDK (server-side only - keep secret!)
FIREBASE_PROJECT_ID=elkan-ai-xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BA...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@elkan-ai-xxxxx.iam.gserviceaccount.com

# Optional: VAPID key for advanced features
NEXT_PUBLIC_FCM_VAPID_KEY=BDxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 5: Install Dependencies

```bash
npm install firebase firebase-admin
```

### Step 6: Create Files

Create these 3 files:

**File 1: `/src/lib/api/fcm-admin.ts`**
- Copy from `FCM_BACKEND_IMPLEMENTATION.md` section 1

**File 2: `/public/firebase-messaging-sw.js`**
- Copy from `FCM_WEB_CLIENT_IMPLEMENTATION.md` section 2

**File 3: `/src/services/notification/fcm.ts`**
- Copy from `FCM_BACKEND_IMPLEMENTATION.md` section 2

### Step 7: Update 4 Existing Files

**File 1: `/src/hooks/useWebPush.ts`**
- Replace entire file with version from `FCM_WEB_CLIENT_IMPLEMENTATION.md`

**File 2: `/src/app/layout.tsx`**
- Add `<FCMProvider>` wrapper and Firebase head tags from `FCM_WEB_CLIENT_IMPLEMENTATION.md`

**File 3: `/src/services/notification/index.ts`**
- Update to use FCM from `FCM_BACKEND_IMPLEMENTATION.md`

**File 4: `/src/models/push-token.model.ts`**
- Update schema for FCM tokens from `FCM_BACKEND_IMPLEMENTATION.md`

### Step 8: Create New API Routes

Create 2 new route files:
- `/src/app/api/v1/notifications/register/route.ts`
- `/src/app/api/v1/notifications/unregister/route.ts`

(Copy from `FCM_BACKEND_IMPLEMENTATION.md`)

### Step 9: Test

```bash
# 1. Start dev server
npm run dev

# 2. Open app in browser
# 3. Check console for FCM initialization message
# 4. Allow notifications when prompted
# 5. Check that token is registered in database
```

---

## 📋 Implementation Checklist

### Phase 1: Setup (30 mins)
- [ ] Firebase project created
- [ ] Web config saved to env
- [ ] Service account key saved to env
- [ ] Dependencies installed

### Phase 2: Backend (2 hours)
- [ ] `/src/lib/api/fcm-admin.ts` created
- [ ] `/src/services/notification/fcm.ts` created
- [ ] `/src/services/notification/index.ts` updated
- [ ] `/src/models/push-token.model.ts` updated
- [ ] Token register API created
- [ ] Token unregister API created
- [ ] Test: Token registration works

### Phase 3: Web Client (2 hours)
- [ ] `/public/firebase-messaging-sw.js` created
- [ ] `/src/lib/firebase/config.ts` created
- [ ] `/src/lib/firebase/messaging.ts` created
- [ ] `/src/hooks/useWebPush.ts` updated
- [ ] `/src/app/layout.tsx` updated
- [ ] `/src/providers/fcm-provider.tsx` created
- [ ] Test: FCM initializes in browser

### Phase 4: Integration (1 hour)
- [ ] Notification components work with new system
- [ ] Existing hooks still work
- [ ] Database queries correct
- [ ] Error handling in place

### Phase 5: Testing (2 hours)
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari
- [ ] Test on mobile (if available)
- [ ] Test background notifications
- [ ] Test foreground notifications
- [ ] Test token refresh
- [ ] Test offline scenarios

### Phase 6: Deployment (1 hour)
- [ ] All env vars configured in production
- [ ] Firebase rules configured
- [ ] Security headers added
- [ ] Rate limiting configured
- [ ] Monitoring set up

---

## 🧪 Test Cases

### Test 1: Basic Setup
```typescript
// Should log: "Firebase Messaging initialized"
// Should not show any errors in console
```

### Test 2: Token Registration
```typescript
// Send POST /api/v1/notifications/register
// Check database: PushToken document created
// Should return 201 with success message
```

### Test 3: Send Notification
```typescript
// Use Firebase Console or API
// Send test message
// Should appear in browser notification center
// Should have app icon
```

### Test 4: Foreground Message
```typescript
// Send message with app open
// Should see toast notification
// Should not show OS notification
```

### Test 5: Background Message
```typescript
// Send message with app closed
// Should see OS notification
// Click notification should open app
```

### Test 6: Token Cleanup
```typescript
// Send to invalid token
// Wait 5 seconds
// Check database: invalid token should be deleted
```

---

## 🔧 Common Issues & Fixes

### Issue: "FCM not configured"
**Solution:** Check all `NEXT_PUBLIC_FIREBASE_*` variables are set

### Issue: "Service Worker not registered"
**Solution:** Make sure `/public/firebase-messaging-sw.js` exists and is accessible

### Issue: "Notification permission denied"
**Solution:** User blocked notifications - show info message, they can re-enable in browser settings

### Issue: "Invalid registration token"
**Solution:** This is normal for old Web Push tokens - they'll be deleted automatically

### Issue: Tokens not being registered
**Solution:** Check that `POST /api/v1/notifications/register` endpoint exists and returns 201

### Issue: No notifications received
**Solution:** Check that:
1. User has granted notification permission
2. Service Worker is registered
3. FCM token exists in database
4. No errors in browser console

---

## 📊 Migration Path

### Phase A: Parallel Running (Days 1-3)
```
Both systems active:
├─ Accept Web Push tokens (legacy)
├─ Accept FCM tokens (new)
├─ Send to both platforms
└─ Users see notifications from both
```

### Phase B: FCM Priority (Days 4-7)
```
Transition phase:
├─ Show in-app message: "Please enable FCM"
├─ Still send to Web Push as fallback
├─ Monitor FCM adoption
└─ Enable for 50% of users
```

### Phase C: Full Migration (Week 2+)
```
Full FCM adoption:
├─ Only send via FCM
├─ Archive Web Push code
├─ Keep VAPID keys for emergency
└─ Monitor reliability
```

---

## 📈 Monitoring & Metrics

### Key Metrics to Track

```typescript
// In /api/v1/notifications/send endpoint
const metrics = {
  totalRequests: 0,
  successfulSends: 0,
  failedSends: 0,
  invalidTokens: 0,
  deliveryTime: [],
  platforms: {
    web: { sent: 0, failed: 0 },
    android: { sent: 0, failed: 0 },
    ios: { sent: 0, failed: 0 },
  },
};

// Log every send
console.log('Notification sent:', {
  userId,
  platform,
  success: result.success,
  failed: result.failed,
  responseTime: Date.now() - startTime,
});
```

### Firebase Console Metrics
- Messages sent
- Delivery rate
- User engagement
- Click-through rate
- Error rates

---

## 🔐 Security Checklist

- [ ] FIREBASE_PRIVATE_KEY not exposed in repo
- [ ] All keys in .env.local and .gitignored
- [ ] Firebase Rules configured to restrict access
- [ ] Rate limiting enabled on token endpoints
- [ ] Only authenticated users can register tokens
- [ ] Tokens validated before sending messages
- [ ] Error messages don't leak system info
- [ ] Logging doesn't log sensitive data

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

```bash
# 1. Verify all environment variables
echo "Checking env vars..."
test -n "$FIREBASE_PROJECT_ID" && echo "✓ FIREBASE_PROJECT_ID"
test -n "$FIREBASE_PRIVATE_KEY" && echo "✓ FIREBASE_PRIVATE_KEY"
test -n "$NEXT_PUBLIC_FIREBASE_API_KEY" && echo "✓ API Key"

# 2. Build and test
npm run build
npm start

# 3. Test in production-like environment
# - Check notifications work
# - Check token registration
# - Check cleanup of invalid tokens

# 4. Monitor error logs
# - Check for FCM errors
# - Check for unregistered tokens
# - Check response times

# 5. Set up alerts
# - High error rate > 5%
# - Delivery time > 10s
# - Invalid tokens > 100/hour
```

### Deployment Steps

```bash
# 1. Merge to main branch
git checkout main
git pull origin main
git merge fcm-migration

# 2. Push to production
git push heroku main
# or
vercel deploy --prod

# 3. Monitor logs for 1 hour
# Check: No FCM errors, tokens registering, notifications sending

# 4. If issues: rollback
git revert <commit-hash>
git push heroku main
```

---

## 📚 Documentation Files

1. **`FCM_MIGRATION_GUIDE.md`** - Complete overview and comparison
2. **`FCM_BACKEND_IMPLEMENTATION.md`** - Server-side code and API routes
3. **`FCM_WEB_CLIENT_IMPLEMENTATION.md`** - Client-side code and hooks
4. **`FCM_IMPLEMENTATION.md`** - This file - quick reference

---

## ⏱️ Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Setup | 30 min | ⏳ Start here |
| Backend | 2 hours | 📝 Implement |
| Web Client | 2 hours | 📝 Implement |
| Integration | 1 hour | 🧪 Test |
| Testing | 2 hours | 🧪 Verify |
| Deployment | 1 hour | 🚀 Deploy |
| **Total** | **8.5 hours** | |

---

## 💡 Tips for Success

1. **Test Early**: Set up a test user and verify notifications work before deploying
2. **Monitor Closely**: Watch logs for first hour after deployment
3. **Gradual Rollout**: Start with 10% of users, then expand
4. **Have Rollback Plan**: Keep Web Push code just in case
5. **Document Changes**: Update your README with FCM instructions
6. **Train Team**: Make sure developers understand new system

---

## 🆘 Getting Help

- [Firebase Docs](https://firebase.google.com/docs)
- [FCM Error Codes](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [FCM Best Practices](https://firebase.google.com/docs/cloud-messaging/concept-options)
- Discord/Slack community channels

---

## ✅ Success Criteria

Your FCM implementation is successful when:

✅ Notifications send without errors  
✅ Tokens register and stay valid  
✅ Users receive both foreground and background notifications  
✅ Notification click handlers work correctly  
✅ Token refresh happens automatically  
✅ Invalid tokens are cleaned up  
✅ All platforms (web, iOS, Android) receive notifications  
✅ Delivery time is < 5 seconds 90% of the time  

---

Generated: January 23, 2026  
Status: 🚀 Ready to implement!
