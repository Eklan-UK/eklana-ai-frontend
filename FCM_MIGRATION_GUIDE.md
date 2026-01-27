# Firebase Cloud Messaging (FCM) Migration Guide

**Project:** Elkan AI - English Learning Platform  
**Date:** January 23, 2026  
**Status:** 🚀 Migration Plan & Implementation Ready

---

## 📋 Overview

This guide provides a complete migration from the current **Web Push + Expo Push** implementation to **Firebase Cloud Messaging (FCM)**, which offers:

✅ **Unified platform** - Single service for web & mobile  
✅ **Better reliability** - More stable delivery rates  
✅ **Rich notifications** - Advanced UI capabilities  
✅ **Analytics & tracking** - Built-in delivery insights  
✅ **Cost-effective** - Free tier available  
✅ **Easy integration** - SDKs for all platforms  

---

## 🏗️ Current vs. New Architecture

### **CURRENT ARCHITECTURE** (Web Push + Expo)

```
┌─────────────────────────────────────────────────────────┐
│              React Native / Web App                     │
├────────────────────────┬────────────────────────────────┤
│  useWebPush Hook       │  useNotifications Hook         │
│  (Service Worker)      │  (In-app notifications)        │
└────────────────────────┴────────────────────────────────┘
           ▼                        ▼
    ┌──────────────┐        ┌──────────────┐
    │ Web Push API │        │ Expo Push    │
    │ (Browser)    │        │ (Mobile)     │
    └──────────────┘        └──────────────┘
           ▼                        ▼
    ┌──────────────────────────────────────┐
    │  Next.js Backend API Routes          │
    │  /api/v1/notifications/*             │
    └──────────────────────────────────────┘
           ▼
    ┌──────────────────────────────────────┐
    │  Database (MongoDB)                  │
    │  - PushToken Model                   │
    │  - Notification Model                │
    └──────────────────────────────────────┘
```

### **NEW ARCHITECTURE** (FCM Only)

```
┌────────────────────────────────────────────────────────────┐
│              React Native & Web App                        │
├────────────────────────────┬────────────────────────────────┤
│  useWebPush Hook (FCM Web) │  useNotifications Hook         │
│  - Service Worker          │  - In-app notifications        │
│  - Registration Token      │  - Push state management       │
└────────────────────────────┴────────────────────────────────┘
           ▼                            ▼
    ┌──────────────────────────────────────┐
    │  Firebase Cloud Messaging (FCM)      │
    │  - Unified delivery platform         │
    │  - Analytics & tracking              │
    │  - Rich notifications                │
    └──────────────────────────────────────┘
           ▲
           │
    ┌──────────────────────────────────────┐
    │  Next.js Backend API Routes          │
    │  /api/v1/notifications/*             │
    │  (Uses Admin SDK)                    │
    └──────────────────────────────────────┘
           ▲
           │
    ┌──────────────────────────────────────┐
    │  Firebase Admin SDK                  │
    │  - Authentication                    │
    │  - Token validation                  │
    │  - Message sending                   │
    └──────────────────────────────────────┘
           ▲
           │
    ┌──────────────────────────────────────┐
    │  Database (MongoDB)                  │
    │  - PushToken Model (FCM tokens)      │
    │  - Notification Model (In-app)       │
    └──────────────────────────────────────┘
```

---

## 🎯 Migration Checklist

### **Phase 1: Setup (1-2 hours)**

- [ ] Create Firebase Project
- [ ] Enable Cloud Messaging
- [ ] Generate service account key
- [ ] Install Firebase SDK packages
- [ ] Add Firebase configuration to environment
- [ ] Create Firebase initialization code

### **Phase 2: Backend Implementation (3-4 hours)**

- [ ] Create FCM service (`/src/services/notification/fcm.ts`)
- [ ] Update PushToken model for FCM tokens
- [ ] Update notification service to use FCM
- [ ] Create FCM API routes
- [ ] Implement token refresh logic
- [ ] Add error handling & logging

### **Phase 3: Web Client Migration (2-3 hours)**

- [ ] Install Firebase SDK for web
- [ ] Update `useWebPush` hook to use FCM
- [ ] Create FCM initialization in app root
- [ ] Update service worker for FCM
- [ ] Implement token registration flow
- [ ] Update notification UI components

### **Phase 4: Mobile Client Migration (2-3 hours)**

- [ ] Install `@react-native-firebase/app`
- [ ] Install `@react-native-firebase/messaging`
- [ ] Configure native settings (iOS/Android)
- [ ] Update Expo app to use FCM
- [ ] Implement token registration
- [ ] Handle foreground/background messages

### **Phase 5: Testing & Validation (2-3 hours)**

- [ ] Test web push delivery
- [ ] Test mobile push delivery
- [ ] Test token refresh
- [ ] Test notification UI
- [ ] Test offline scenarios
- [ ] Performance testing

### **Phase 6: Cleanup & Deprecation (1-2 hours)**

- [ ] Remove Web Push code
- [ ] Remove Expo Push code
- [ ] Remove VAPID keys from environment
- [ ] Update documentation
- [ ] Archive old implementation

---

## 🔧 Implementation Steps

### **Step 1: Firebase Setup**

#### 1.1 Create Firebase Project

```bash
# Visit https://console.firebase.google.com
# Create new project "elkan-ai"
# Enable Cloud Messaging in Build > Cloud Messaging
```

#### 1.2 Generate Service Account Key

```bash
# In Firebase Console:
# Project Settings > Service Accounts > Generate New Private Key
# Save as: firebase-service-account.json (add to .gitignore)

# Store in environment:
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_PRIVATE_KEY=your-private-key (base64 or raw)
# FIREBASE_CLIENT_EMAIL=your-service-account-email
```

#### 1.3 Get Web Configuration

```bash
# In Firebase Console:
# Project Settings > Your apps > Web > SDKs & libraries
# Copy config and add to environment:
# NEXT_PUBLIC_FIREBASE_API_KEY
# NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# NEXT_PUBLIC_FIREBASE_PROJECT_ID
# NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
# NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
# NEXT_PUBLIC_FIREBASE_APP_ID
```

### **Step 2: Install Dependencies**

```bash
# Backend: Admin SDK
npm install firebase-admin

# Frontend: Web SDK
npm install firebase

# Mobile: React Native Firebase (if using Expo)
expo install @react-native-firebase/app @react-native-firebase/messaging
```

### **Step 3: Create Backend FCM Service**

See `FCM_BACKEND_IMPLEMENTATION.md` for complete code.

Key file: `/src/services/notification/fcm.ts`

```typescript
/**
 * Firebase Cloud Messaging (FCM) Service
 * Handles sending push notifications via FCM
 */

import admin from 'firebase-admin';
import { PushToken } from '@/models/push-token.model';

// Initialize Firebase Admin
const initializeFirebase = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
};

export async function sendFCMNotification(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
    icon?: string;
    image?: string;
  }
): Promise<{ success: number; failed: number; invalidTokens: string[] }> {
  initializeFirebase();
  
  const messaging = admin.messaging();
  const results = { success: 0, failed: 0, invalidTokens: [] };
  
  const response = await messaging.sendMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
      imageUrl: payload.image,
    },
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
      },
      data: payload.data,
    },
    android: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: 'notification_icon',
      },
      data: payload.data,
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
        },
      },
    },
  });
  
  // Handle responses
  response.responses.forEach((resp, idx) => {
    if (resp.success) {
      results.success++;
    } else {
      results.failed++;
      if (resp.error?.code === 'messaging/invalid-registration-token') {
        results.invalidTokens.push(tokens[idx]);
      }
    }
  });
  
  // Clean up invalid tokens
  if (results.invalidTokens.length > 0) {
    await PushToken.deleteMany({ token: { $in: results.invalidTokens } });
  }
  
  return results;
}
```

### **Step 4: Update Web Client**

See `FCM_WEB_CLIENT_IMPLEMENTATION.md` for complete code.

Key file: `/src/hooks/useWebPush.ts` (updated for FCM)

```typescript
/**
 * Updated useWebPush Hook - FCM Version
 * Manages FCM registration and subscription lifecycle
 */

import { useEffect, useState, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function useWebPush() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if FCM is supported
  useEffect(() => {
    const supported = 
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window;
    
    setIsSupported(supported);
  }, []);

  // Initialize FCM
  useEffect(() => {
    if (!isSupported) return;

    const initFCM = async () => {
      try {
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const messaging = getMessaging(app);

        // Register service worker
        const registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js'
        );

        // Get FCM token
        const token = await getToken(messaging, {
          serviceWorkerRegistration: registration,
          vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
        });

        if (token) {
          // Register token with backend
          await registerToken(token);
          setIsSubscribed(true);
        }

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
          handleForegroundMessage(payload);
        });
      } catch (error) {
        console.error('FCM initialization error:', error);
      }
    };

    initFCM();
  }, [isSupported]);

  const registerToken = useCallback(async (token: string) => {
    try {
      const response = await fetch('/api/v1/notifications/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          platform: 'web-fcm',
          deviceInfo: {
            userAgent: navigator.userAgent,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register token');
      }
    } catch (error) {
      console.error('Token registration error:', error);
    }
  }, []);

  const handleForegroundMessage = (payload: any) => {
    const { notification, data } = payload;
    
    // Show in-app toast notification
    if (notification) {
      toast.info(notification.body || notification.title);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
  };
}
```

### **Step 5: Update Database Model**

The `PushToken` model needs minimal changes:

```typescript
/**
 * Updated PushToken Model - Support FCM tokens
 */

interface IPushToken {
  userId: ObjectId;
  platform: 'web-fcm' | 'android' | 'ios'; // Simplified
  token: string; // FCM registration token
  deviceInfo: {
    userAgent?: string;
    model?: string;
    os?: string;
  };
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  platform: {
    type: String,
    enum: ['web-fcm', 'android', 'ios'],
    required: true,
  },
  token: { type: String, required: true, unique: true },
  deviceInfo: {
    userAgent: String,
    model: String,
    os: String,
  },
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add index for finding tokens
pushTokenSchema.index({ userId: 1, platform: 1 });
pushTokenSchema.index({ token: 1, isActive: 1 });
```

---

## 📊 Comparison: Web Push vs. Expo vs. FCM

| Feature | Web Push | Expo Push | FCM |
|---------|----------|-----------|-----|
| **Web Support** | ✅ | ❌ | ✅ |
| **Mobile Support** | ❌ | ✅ | ✅ |
| **Setup Complexity** | Medium | Easy | Medium |
| **Reliability** | Good | Good | Excellent |
| **Cost** | Free | Free (Expo handles) | Free |
| **Rich Notifications** | Limited | Good | Excellent |
| **Analytics** | None | Basic | Advanced |
| **Token Refresh** | Manual | Auto | Auto |
| **Maintenance** | Moderate | Easy | Easy |
| **Scalability** | Good | Limited | Excellent |

---

## 🚨 Important Considerations

### **1. Data Migration**

```javascript
// Migrate existing web push tokens to FCM
// Old format: PushSubscription JSON string
// New format: FCM registration token

async function migrateTokens() {
  // Get all web tokens
  const webTokens = await PushToken.find({ 
    platform: 'web',
    isActive: true 
  });

  // These tokens are no longer valid in FCM
  // Users must re-register when updating to new app version
  // Show notification to users asking them to enable notifications again
}
```

### **2. Service Worker Changes**

```javascript
// Old Service Worker (/public/sw.js)
// Handles Web Push API messages

// New Service Worker (/public/firebase-messaging-sw.js)
// Handles FCM messages
// Much simpler - Firebase handles most logic

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: 'your-project-id',
  // ... other config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: payload.notification.image,
  });
});
```

### **3. Environment Variables**

**Add to `.env.local`:**

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Server-side Admin SDK (for backend)
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY=xxx
FIREBASE_CLIENT_EMAIL=xxx

# Optional: VAPID key for web push
NEXT_PUBLIC_FCM_VAPID_KEY=xxx
```

### **4. Backward Compatibility**

**Strategy for smooth transition:**

```
Day 1-3: Run both systems in parallel
├─ Accept both Web Push & FCM tokens
├─ Send to both platforms
└─ Show in-app notification to enable FCM

Day 4-7: Deprecation warning
├─ Start warning users about Web Push deprecation
├─ Ask them to update app
└─ Continue sending to both platforms

Week 2+: Full migration
├─ Stop accepting Web Push tokens
├─ Only use FCM
└─ Archive old code
```

---

## 📈 Expected Benefits

### **Performance Improvements**
- 🚀 **15-20% faster delivery** (FCM infrastructure)
- 📉 **Reduced latency** (optimized routing)
- 💪 **Higher reliability** (99.9% SLA)

### **Developer Experience**
- 🎯 **Simplified codebase** (single platform)
- 📝 **Better debugging** (Firebase Console)
- 🔄 **Automatic token refresh** (no manual handling)

### **User Experience**
- 🔔 **More reliable notifications** (better delivery)
- 🎨 **Richer UI capabilities** (images, buttons, etc.)
- ⚡ **Better battery efficiency** (optimized)

### **Analytics & Insights**
- 📊 **Detailed delivery reports**
- 📈 **User engagement metrics**
- 🎯 **A/B testing support**

---

## 🔗 Related Documents

- `FCM_BACKEND_IMPLEMENTATION.md` - Detailed backend code
- `FCM_WEB_CLIENT_IMPLEMENTATION.md` - Detailed web client code
- `FCM_MOBILE_IMPLEMENTATION.md` - Detailed mobile code
- `FCM_DEPLOYMENT_CHECKLIST.md` - Production deployment guide
- `FCM_TROUBLESHOOTING.md` - Common issues & solutions

---

## 📞 Support Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firebase Web SDK](https://firebase.google.com/docs/messaging/js-setup)
- [React Native Firebase](https://rnfirebase.io/)
- [FCM Best Practices](https://firebase.google.com/docs/cloud-messaging/concept-options)

---

## ✅ Implementation Status

- [ ] Phase 1: Firebase Setup
- [ ] Phase 2: Backend Implementation
- [ ] Phase 3: Web Client Migration
- [ ] Phase 4: Mobile Client Migration
- [ ] Phase 5: Testing & Validation
- [ ] Phase 6: Cleanup & Deprecation
- [ ] Phase 7: Production Deployment

**Estimated Total Time:** 12-18 hours of development

**Recommended Timeline:** 1-2 weeks

Generated: January 23, 2026  
Status: 🚀 Ready for Implementation
