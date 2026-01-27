/**
 * FCM Token Management Service
 * Handles registration, storage, and lifecycle of FCM tokens
 */

import axios from "./api/axios";
import { getFCMToken, requestNotificationPermission } from "./firebase";

interface FCMTokenData {
  token: string;
  userId: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    browser: string;
  };
  registeredAt: Date;
}

/**
 * Register FCM token with backend
 * Called when user grants notification permission
 */
export const registerFCMToken = async (
  userId: string,
  token?: string,
): Promise<{ success: boolean; token?: string; error?: string }> => {
  try {
    // Get token if not provided
    let fcmToken = token || (await getFCMToken());

    if (!fcmToken) {
      console.warn("No FCM token available");
      return { success: false, error: "No FCM token available" };
    }

    // Send token to backend
    const response = await axios.post("/fcm/tokens", {
      token: fcmToken,
      userId,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        browser: navigator.vendor,
      },
    });

    console.log("FCM token registered successfully");

    // Store token in localStorage for offline reference
    localStorage.setItem(`fcm_token_${userId}`, fcmToken);
    localStorage.setItem("fcm_token_registered_at", new Date().toISOString());

    return { success: true, token: fcmToken };
  } catch (error) {
    console.error("Error registering FCM token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Refresh FCM token (called periodically)
 * FCM tokens can be refreshed and backend needs to know about new tokens
 */
export const refreshFCMToken = async (
  userId: string,
): Promise<{ success: boolean; token?: string; error?: string }> => {
  try {
    const newToken = await getFCMToken();

    if (!newToken) {
      console.warn("Could not refresh FCM token");
      return { success: false, error: "Could not refresh FCM token" };
    }

    // Get stored token
    const storedToken = localStorage.getItem(`fcm_token_${userId}`);

    // Only send to backend if token changed
    if (newToken !== storedToken) {
      const response = await axios.put("/fcm/tokens/refresh", {
        oldToken: storedToken,
        newToken,
        userId,
      });

      console.log("FCM token refreshed successfully");
      localStorage.setItem(`fcm_token_${userId}`, newToken);

      return { success: true, token: newToken };
    }

    return { success: true, token: newToken };
  } catch (error) {
    console.error("Error refreshing FCM token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Unregister FCM token (called on logout)
 */
export const unregisterFCMToken = async (
  userId: string,
  token?: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    let fcmToken = token || localStorage.getItem(`fcm_token_${userId}`);

    if (!fcmToken) {
      console.warn("No FCM token to unregister");
      return { success: false, error: "No FCM token to unregister" };
    }

    // Notify backend to remove token
    await axios.delete("/fcm/tokens", {
      data: { token: fcmToken, userId },
    });

    // Clear from localStorage
    localStorage.removeItem(`fcm_token_${userId}`);
    localStorage.removeItem("fcm_token_registered_at");

    console.log("FCM token unregistered successfully");
    return { success: true };
  } catch (error) {
    console.error("Error unregistering FCM token:", error);
    // Don't fail silently - user is logging out
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Initialize FCM for user
 * 1. Request notification permission
 * 2. Get FCM token
 * 3. Register with backend
 * 4. Set up token refresh interval
 */
export const initializeFCM = async (
  userId: string,
): Promise<{ success: boolean; token?: string; error?: string }> => {
  try {
    // Step 1: Request permission
    const permissionGranted = await requestNotificationPermission();

    if (!permissionGranted) {
      console.warn("User did not grant notification permission");
      return {
        success: false,
        error: "Notification permission not granted",
      };
    }

    // Step 2: Get FCM token
    const token = await getFCMToken();

    if (!token) {
      console.error("Failed to get FCM token");
      return { success: false, error: "Failed to get FCM token" };
    }

    // Step 3: Register token with backend
    const result = await registerFCMToken(userId, token);

    if (!result.success) {
      return result;
    }

    // Step 4: Set up token refresh interval (every 7 days)
    const refreshInterval = setInterval(
      () => {
        refreshFCMToken(userId);
      },
      7 * 24 * 60 * 60 * 1000,
    ); // 7 days

    // Store interval ID for cleanup
    sessionStorage.setItem("fcm_refresh_interval", refreshInterval.toString());

    return { success: true, token };
  } catch (error) {
    console.error("Error initializing FCM:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Clean up FCM resources
 */
export const cleanupFCM = (userId: string) => {
  try {
    // Clear refresh interval
    const intervalId = sessionStorage.getItem("fcm_refresh_interval");
    if (intervalId) {
      clearInterval(Number(intervalId));
      sessionStorage.removeItem("fcm_refresh_interval");
    }

    console.log("FCM cleanup completed");
  } catch (error) {
    console.error("Error cleaning up FCM:", error);
  }
};

/**
 * Get stored FCM token from localStorage
 */
export const getStoredFCMToken = (userId: string): string | null => {
  return localStorage.getItem(`fcm_token_${userId}`);
};

/**
 * Subscribe to topic
 */
export const subscribeTopic = async (
  userId: string,
  topic: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const token = localStorage.getItem(`fcm_token_${userId}`);

    if (!token) {
      return { success: false, error: "No FCM token available" };
    }

    await axios.post("/fcm/topics/subscribe", {
      token,
      topic,
      userId,
    });

    console.log(`Subscribed to topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error("Error subscribing to topic:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Unsubscribe from topic
 */
export const unsubscribeTopic = async (
  userId: string,
  topic: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const token = localStorage.getItem(`fcm_token_${userId}`);

    if (!token) {
      return { success: false, error: "No FCM token available" };
    }

    await axios.post("/fcm/topics/unsubscribe", {
      token,
      topic,
      userId,
    });

    console.log(`Unsubscribed from topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error("Error unsubscribing from topic:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export default {
  registerFCMToken,
  refreshFCMToken,
  unregisterFCMToken,
  initializeFCM,
  cleanupFCM,
  getStoredFCMToken,
  subscribeTopic,
  unsubscribeTopic,
};
