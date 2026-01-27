/**
 * Firebase Client Configuration
 * Handles FCM token management and messaging
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getMessaging,
  Messaging,
  onMessage,
  getToken,
  isSupported,
} from "firebase/messaging";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let messaging: Messaging | null = null;

/**
 * Initialize Firebase app (singleton pattern)
 */
export const initializeFirebase = (): FirebaseApp => {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  return app;
};

/**
 * Get Firebase Messaging instance
 * Only available in browsers that support Notification API and Service Workers
 */
export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  // Check if browser supports FCM
  if (typeof window !== "undefined" && (await isSupported())) {
    if (!messaging) {
      const app = initializeFirebase();
      messaging = getMessaging(app);
    }
    return messaging;
  }
  return null;
};

/**
 * Register the Firebase Messaging Service Worker
 */
const registerFirebaseServiceWorker =
  async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      if ("serviceWorker" in navigator) {
        // Register the Firebase messaging service worker
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          {
            scope: "/",
          },
        );
        console.log("Firebase Service Worker registered:", registration);
        return registration;
      }
      return null;
    } catch (error) {
      console.error("Error registering Firebase Service Worker:", error);
      return null;
    }
  };

/**
 * Get FCM token for the current device
 * Requires service worker to be registered and notification permission granted
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      console.warn("Firebase Messaging not supported in this browser");
      return null;
    }

    // Check if notification permission is already granted
    if (Notification.permission !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    // Register Firebase Service Worker if not already registered
    const existingRegistration = await navigator.serviceWorker.getRegistration(
        "/firebase-messaging-sw.js",
      );
    let registration: ServiceWorkerRegistration | null = existingRegistration || null;

    if (!registration) {
      console.log("Firebase Service Worker not found, registering...");
      registration = await registerFirebaseServiceWorker();
    }

    if (!registration) {
      console.error("Service Worker not registered");
      return null;
    }

    // Get FCM token with VAPID public key
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

/**
 * Register listener for incoming messages when app is in foreground
 */
export const registerMessageListener = async (
  callback: (message: any) => void,
) => {
  try {
    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      console.warn("Firebase Messaging not supported");
      return;
    }

    onMessage(messaging, (payload) => {
      console.log("Message received in foreground:", payload);
      callback(payload);
    });
  } catch (error) {
    console.error("Error registering message listener:", error);
  }
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    // Check if browser supports Notification API
    if (!("Notification" in window)) {
      console.warn("Notification API not supported");
      return false;
    }

    // If permission already granted
    if (Notification.permission === "granted") {
      return true;
    }

    // If permission was denied
    if (Notification.permission === "denied") {
      console.warn("Notification permission denied by user");
      return false;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

/**
 * Delete FCM token (called on logout)
 */
export const deleteFCMToken = async (): Promise<void> => {
  try {
    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      return;
    }

    // Firebase SDK doesn't provide a direct delete method
    // Tokens are automatically invalidated after 60 days of inactivity
    // Send token deletion request to backend to remove from database
  } catch (error) {
    console.error("Error deleting FCM token:", error);
  }
};

export default {
  initializeFirebase,
  getFirebaseMessaging,
  getFCMToken,
  registerMessageListener,
  requestNotificationPermission,
  deleteFCMToken,
};
