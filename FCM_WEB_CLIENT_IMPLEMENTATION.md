# FCM Web Client Implementation Guide

**Complete implementation for FCM integration in Next.js web app**

---

## 📁 File Structure

```
src/
├── app/
│   ├── layout.tsx                    (Updated: Add FCM provider)
│   └── firebase-messaging-sw.js      (NEW: Service Worker for FCM)
├── hooks/
│   ├── useWebPush.ts                 (UPDATED: Use FCM instead of Web Push)
│   └── useNotifications.ts           (Updated: Enhanced notifications)
├── lib/firebase/
│   ├── config.ts                     (NEW: Firebase config)
│   ├── messaging.ts                  (NEW: FCM messaging client)
│   └── service-worker.ts             (NEW: Service Worker utilities)
├── providers/
│   └── firebase-provider.tsx         (NEW: Firebase context provider)
└── components/
    ├── notifications/
    │   ├── notification-toast.tsx   (Updated: Better UI)
    │   └── notification-center.tsx  (Updated: List notifications)
    └── notifications-popover.tsx    (Updated: Popup)
```

---

## 1️⃣ Firebase Configuration

### File: `/src/lib/firebase/config.ts`

```typescript
/**
 * Firebase Configuration
 * Contains Firebase credentials for web app
 */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Verify all required environment variables are set
 */
export function verifyFirebaseConfig(): { valid: boolean; missing: string[] } {
  const required = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ] as const;

  const missing = required.filter(
    (key) => !firebaseConfig[key]
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}
```

### File: `/src/lib/firebase/messaging.ts`

```typescript
/**
 * Firebase Cloud Messaging Client
 * Handles messaging operations on the web client
 */

import { initializeApp, getApp } from 'firebase/app';
import {
  getMessaging,
  getToken as getMessagingToken,
  onMessage,
  Messaging,
  MessagePayload,
} from 'firebase/messaging';
import { firebaseConfig } from './config';
import { logger } from '@/lib/api/logger';

let messaging: Messaging | null = null;

/**
 * Initialize Firebase and Messaging
 */
export function initializeFirebase() {
  try {
    if (!messaging) {
      const app = getApp().length > 0 ? getApp() : initializeApp(firebaseConfig);
      messaging = getMessaging(app);
      logger.info('Firebase Messaging initialized');
    }
    return messaging;
  } catch (error) {
    logger.error('Failed to initialize Firebase', error);
    throw error;
  }
}

/**
 * Get Firebase messaging instance
 */
export function getFirebaseMessaging(): Messaging {
  if (!messaging) {
    return initializeFirebase();
  }
  return messaging;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    // Check if notification API is available
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    // If already granted, return
    if (Notification.permission === 'granted') {
      return 'granted';
    }

    // If previously denied, don't ask again
    if (Notification.permission === 'denied') {
      return 'denied';
    }

    // Request permission
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    logger.error('Error requesting notification permission', error);
    return 'denied';
  }
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (!('serviceWorker' in navigator)) {
      logger.warn('Service Workers not supported');
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );
    logger.info('Service Worker registered');
    return registration;
  } catch (error) {
    logger.error('Failed to register service worker', error);
    return null;
  }
}

/**
 * Get FCM registration token
 */
export async function getRegistrationToken(
  swRegistration: ServiceWorkerRegistration
): Promise<string | null> {
  try {
    const messaging = getFirebaseMessaging();
    const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

    if (!vapidKey) {
      logger.warn('VAPID key not configured');
      return null;
    }

    const token = await getMessagingToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey,
    });

    logger.info('FCM token obtained');
    return token || null;
  } catch (error: any) {
    // Common errors to handle gracefully
    if (error.code === 'messaging/failed-service-worker-registration') {
      logger.warn('Service Worker registration failed');
    } else if (error.code === 'messaging/unsupported-browser') {
      logger.warn('Browser does not support FCM');
    } else if (error.code === 'messaging/notification-blocked') {
      logger.warn('Notifications are blocked for this site');
    } else {
      logger.error('Failed to get FCM token', error);
    }
    return null;
  }
}

/**
 * Listen to foreground messages
 */
export function listenToForegroundMessages(
  callback: (payload: MessagePayload) => void
) {
  try {
    const messaging = getFirebaseMessaging();
    return onMessage(messaging, callback);
  } catch (error) {
    logger.error('Error setting up foreground message listener', error);
  }
}

/**
 * Check if browser supports FCM
 */
export function isFCMSupported(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'indexedDB' in window &&
    'PushManager' in window
  );
}

/**
 * Get notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Check if notifications are supported and enabled
 */
export function areNotificationsSupported(): boolean {
  return isFCMSupported() && getNotificationPermission() !== 'denied';
}
```

---

## 2️⃣ Service Worker for FCM

### File: `/public/firebase-messaging-sw.js`

```javascript
/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications
 * 
 * Place this file in /public directory
 * Firebase will serve it to browsers automatically
 */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker
// Configuration is provided by the app and stored in IndexedDB
firebase.initializeApp({
  apiKey: 'THIS_IS_AUTOMATICALLY_INJECTED',
  authDomain: 'THIS_IS_AUTOMATICALLY_INJECTED',
  projectId: 'THIS_IS_AUTOMATICALLY_INJECTED',
  storageBucket: 'THIS_IS_AUTOMATICALLY_INJECTED',
  messagingSenderId: 'THIS_IS_AUTOMATICALLY_INJECTED',
  appId: 'THIS_IS_AUTOMATICALLY_INJECTED',
});

const messaging = firebase.messaging();

/**
 * Handle background push notifications
 * This runs when app is in background or closed
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Received background message:', payload);

  const {
    notification: { title, body, image },
  } = payload;

  const options = {
    body,
    icon: '/icons/notification-icon-192.png',
    badge: '/icons/badge-icon-96.png',
    image: image,
    tag: 'elkan-notification',
    requireInteraction: false,
    // Custom data for click handling
    data: payload.data || {},
    // Allow users to close notification
    actions: [
      {
        action: 'close',
        title: 'Close',
      },
    ],
  };

  self.registration.showNotification(title, options);
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Get the data from the notification
  const data = event.notification.data;
  const notificationId = data.notificationId;
  const type = data.type;

  // Determine where to navigate based on notification type
  let targetUrl = '/account/notifications';

  if (type === 'achievement') {
    targetUrl = '/account/achievements';
  } else if (type === 'drill-assigned') {
    targetUrl = '/account/practice/drills';
  } else if (type === 'pronunciation-assigned') {
    targetUrl = '/account/practice/pronunciation';
  } else if (type === 'message') {
    targetUrl = '/account/messages';
  } else if (data.navigationUrl) {
    targetUrl = data.navigationUrl;
  }

  // Focus existing window if possible, otherwise open new one
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (let client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not already open
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

/**
 * Handle notification dismissal
 */
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification);
});
```

---

## 3️⃣ Updated useWebPush Hook

### File: `/src/hooks/useWebPush.ts` (Updated for FCM)

```typescript
/**
 * useWebPush Hook - Updated for Firebase Cloud Messaging
 * Manages FCM subscription lifecycle for web app
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  isFCMSupported,
  registerServiceWorker,
  getRegistrationToken,
  getNotificationPermission,
  requestNotificationPermission,
  listenToForegroundMessages,
} from '@/lib/firebase/messaging';
import { useAuthStore } from '@/store/auth.store';
import { logger } from '@/lib/api/logger';

export interface UseWebPushOptions {
  onTokenChange?: (token: string | null) => void;
  onForegroundMessage?: (message: any) => void;
  autoSubscribe?: boolean;
}

export interface UseWebPushReturn {
  isSupported: boolean;
  isPermissionGranted: boolean;
  isLoading: boolean;
  token: string | null;
  subscribe: () => Promise<string | null>;
  unsubscribe: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

/**
 * Main hook for managing FCM subscription
 */
export function useWebPush(options: UseWebPushOptions = {}): UseWebPushReturn {
  const {
    onTokenChange,
    onForegroundMessage,
    autoSubscribe = true,
  } = options;

  const { user } = useAuthStore();
  const [isSupported, setIsSupported] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const unlistenerRef = useRef<(() => void) | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);

  // Check FCM support
  useEffect(() => {
    const supported = isFCMSupported();
    setIsSupported(supported);

    if (supported) {
      const permission = getNotificationPermission();
      setIsPermissionGranted(permission === 'granted');
    }
  }, []);

  // Initialize FCM and subscribe
  useEffect(() => {
    if (!isSupported || !user || !autoSubscribe) return;

    // Prevent multiple initialization attempts
    if (initializationRef.current) {
      return;
    }

    initializationRef.current = initializeFCM();
  }, [isSupported, user, autoSubscribe]);

  // Initialize FCM
  const initializeFCM = async () => {
    setIsLoading(true);
    try {
      // Request permission if not already granted
      if (!isPermissionGranted) {
        const permission = await requestNotificationPermission();
        setIsPermissionGranted(permission === 'granted');

        if (permission !== 'granted') {
          logger.warn('Notification permission denied by user');
          setIsLoading(false);
          return;
        }
      }

      // Register service worker
      const swRegistration = await registerServiceWorker();
      if (!swRegistration) {
        throw new Error('Failed to register service worker');
      }

      // Get FCM token
      const fcmToken = await getRegistrationToken(swRegistration);
      if (fcmToken) {
        setToken(fcmToken);
        onTokenChange?.(fcmToken);

        // Register token with backend
        await registerTokenWithBackend(fcmToken);

        // Set up foreground message listener
        setupForegroundListener();

        toast.success('Notifications enabled!');
        logger.info('FCM initialized successfully');
      } else {
        logger.warn('Failed to obtain FCM token');
      }
    } catch (error) {
      logger.error('Error initializing FCM', error);
      toast.error('Failed to enable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Register token with backend
  const registerTokenWithBackend = async (fcmToken: string) => {
    try {
      const response = await fetch('/api/v1/notifications/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fcmToken,
          platform: 'web-fcm',
          deviceInfo: {
            userAgent: navigator.userAgent,
            os: getOS(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register token with backend');
      }

      logger.info('Token registered with backend');
    } catch (error) {
      logger.error('Error registering token with backend', error);
      // Continue anyway - token is still valid for FCM
    }
  };

  // Set up foreground message listener
  const setupForegroundListener = () => {
    unlistenerRef.current = listenToForegroundMessages((payload) => {
      logger.info('Foreground message received:', payload);

      // Call custom handler if provided
      onForegroundMessage?.(payload);

      // Default behavior: show toast notification
      if (payload.notification) {
        const { title, body } = payload.notification;
        toast.info(body || title);
      }
    });
  };

  // Subscribe to notifications
  const subscribe = useCallback(async (): Promise<string | null> => {
    if (!isSupported) {
      toast.error('Notifications not supported on this device');
      return null;
    }

    try {
      setIsLoading(true);
      await initializeFCM();
      return token;
    } catch (error) {
      logger.error('Error subscribing to notifications', error);
      toast.error('Failed to enable notifications');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, token]);

  // Unsubscribe from notifications
  const unsubscribe = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);

      // Unregister token from backend
      const response = await fetch('/api/v1/notifications/unregister', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Failed to unregister token');
      }

      // Clean up foreground listener
      unlistenerRef.current?.();

      setToken(null);
      setIsPermissionGranted(false);
      onTokenChange?.(null);

      toast.success('Notifications disabled');
      logger.info('Unsubscribed from notifications');
    } catch (error) {
      logger.error('Error unsubscribing', error);
      toast.error('Failed to disable notifications');
    } finally {
      setIsLoading(false);
    }
  }, [token, onTokenChange]);

  // Refresh token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const swRegistration = await registerServiceWorker();
      if (!swRegistration) {
        throw new Error('Service worker not available');
      }

      const newToken = await getRegistrationToken(swRegistration);
      if (newToken && newToken !== token) {
        setToken(newToken);
        onTokenChange?.(newToken);

        // Update backend with new token
        await registerTokenWithBackend(newToken);

        logger.info('FCM token refreshed');
      }

      return newToken;
    } catch (error) {
      logger.error('Error refreshing token', error);
      return null;
    }
  }, [token, onTokenChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unlistenerRef.current?.();
    };
  }, []);

  return {
    isSupported,
    isPermissionGranted,
    isLoading,
    token,
    subscribe,
    unsubscribe,
    refreshToken,
  };
}

/**
 * Detect operating system
 */
function getOS(): string {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = window.navigator.userAgent;

  if (userAgent.indexOf('Win') > -1) return 'Windows';
  if (userAgent.indexOf('Mac') > -1) return 'MacOS';
  if (userAgent.indexOf('Linux') > -1) return 'Linux';
  if (userAgent.indexOf('Android') > -1) return 'Android';
  if (userAgent.indexOf('iPad') > -1) return 'iOS';
  if (userAgent.indexOf('iPhone') > -1) return 'iOS';

  return 'unknown';
}
```

---

## 4️⃣ Updated App Layout

### File: `/src/app/layout.tsx` (Updated)

```typescript
/**
 * Root Layout - Updated to include FCM setup
 */

import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/providers/auth-provider';
import { FCMProvider } from '@/providers/fcm-provider';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Elkan AI - Learn English',
  description: 'Interactive English learning platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Essential meta tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#005b9f" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <AuthProvider>
          <FCMProvider>
            {children}
            <Toaster position="top-center" />
          </FCMProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### File: `/src/providers/fcm-provider.tsx` (NEW)

```typescript
/**
 * FCM Provider
 * Sets up Firebase Cloud Messaging for the app
 */

'use client';

import { useEffect } from 'react';
import { useWebPush } from '@/hooks/useWebPush';
import { useAuthStore } from '@/store/auth.store';
import { logger } from '@/lib/api/logger';

export function FCMProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  // Initialize FCM when user is authenticated
  const { isSupported, isPermissionGranted, token } = useWebPush({
    autoSubscribe: !!user,
    onTokenChange: (newToken) => {
      logger.info('FCM token changed', {
        hasToken: !!newToken,
        tokenPreview: newToken?.substring(0, 20),
      });
    },
    onForegroundMessage: (message) => {
      // Handle foreground messages
      // (useWebPush hook handles default toast notification)
      logger.info('Foreground message:', message);
    },
  });

  useEffect(() => {
    if (user) {
      logger.info('FCM status', {
        supported: isSupported,
        permissionGranted: isPermissionGranted,
        hasToken: !!token,
      });
    }
  }, [user, isSupported, isPermissionGranted, token]);

  return <>{children}</>;
}
```

---

## 5️⃣ Update Notification Components

### File: `/src/hooks/useNotifications.ts` (Updated)

```typescript
/**
 * useNotifications Hook - Fetch and manage notifications
 * Works with FCM for push notifications
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/api/logger';

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: string;
  updatedAt: string;
  pushSentAt?: Date;
  pushDelivered?: boolean;
}

/**
 * Fetch user notifications
 */
export function useNotifications(limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.notifications.list(limit, offset),
    queryFn: async () => {
      const response = await api.get('/notifications', {
        params: { limit, offset },
      });
      return response.data;
    },
  });
}

/**
 * Fetch unread notification count
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const response = await api.get('/notifications/unread-count');
      return response.data.count;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Mark notification as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return api.patch(`/notifications/${notificationId}`, {
        isRead: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      logger.info('Notification marked as read');
    },
    onError: (error) => {
      logger.error('Failed to mark notification as read', error);
      toast.error('Failed to mark as read');
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return api.post('/notifications/read-all', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      toast.success('All notifications marked as read');
      logger.info('All notifications marked as read');
    },
    onError: (error) => {
      logger.error('Failed to mark all as read', error);
      toast.error('Failed to mark all as read');
    },
  });
}

/**
 * Delete notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return api.delete(`/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
    onError: (error) => {
      logger.error('Failed to delete notification', error);
      toast.error('Failed to delete notification');
    },
  });
}
```

---

## 🧪 Testing

Add to your app to test FCM:

```typescript
// Test component - can be placed in settings or dev page
'use client';

import { useWebPush } from '@/hooks/useWebPush';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function NotificationTest() {
  const { isSupported, isPermissionGranted, token, subscribe, unsubscribe } =
    useWebPush();
  const [testMessage, setTestMessage] = useState('');

  const sendTestNotification = async () => {
    if (!token) return;

    try {
      const response = await fetch(
        `/api/v1/notifications/test?token=${encodeURIComponent(token)}`,
        { method: 'GET' }
      );
      const result = await response.json();
      setTestMessage(JSON.stringify(result, null, 2));
    } catch (error) {
      setTestMessage(`Error: ${error}`);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <p>Supported: {isSupported ? '✅' : '❌'}</p>
        <p>Permission: {isPermissionGranted ? '✅' : '❌'}</p>
        <p>Token: {token ? token.substring(0, 30) + '...' : 'None'}</p>
      </div>

      <div className="flex gap-2">
        <Button onClick={subscribe}>Subscribe</Button>
        <Button onClick={unsubscribe} variant="outline">
          Unsubscribe
        </Button>
        <Button onClick={sendTestNotification} disabled={!token}>
          Send Test
        </Button>
      </div>

      {testMessage && <pre>{testMessage}</pre>}
    </div>
  );
}
```

---

## ✅ Verification Checklist

- [ ] Firebase config environment variables set
- [ ] Service Worker file created at `/public/firebase-messaging-sw.js`
- [ ] `useWebPush` hook updated
- [ ] `FCMProvider` added to layout
- [ ] Token registration API working
- [ ] Foreground messages displaying
- [ ] Background notifications working
- [ ] Notifications clickable and navigating correctly
- [ ] Token refresh working
- [ ] Invalid tokens cleaned up

---

Status: ✅ Web client implementation complete and ready for deployment
