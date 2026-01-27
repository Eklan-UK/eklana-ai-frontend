/**
 * useFCM Hook
 * Manages FCM initialization, token registration, and message listening
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import {
  initializeFCM,
  cleanupFCM,
  unregisterFCMToken,
  getStoredFCMToken,
  subscribeTopic,
  unsubscribeTopic,
} from "@/lib/fcm-token-manager";
import { registerMessageListener } from "@/lib/firebase";

interface FCMState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
}

interface FCMNotification {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  image?: string;
  data?: Record<string, string>;
  actionUrl?: string;
}

export const useFCM = () => {
  const { data: session } = useSession();
  const [state, setState] = useState<FCMState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    token: null,
  });
  const [lastNotification, setLastNotification] =
    useState<FCMNotification | null>(null);
  const initRef = useRef(false);

  // Initialize FCM on session change
  useEffect(() => {
    if (!session || !session.user || initRef.current) {
      return;
    }

    initRef.current = true;

    const initialize = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Initialize FCM
        const result = await initializeFCM(session.user.id);

        if (result.success && result.token) {
          setState({
            isInitialized: true,
            isLoading: false,
            error: null,
            token: result.token,
          });

          // Register foreground message listener
          await registerMessageListener((payload: any) => {
            console.log("=== FCM Message Received ===");
            console.log("Full payload:", payload);
            console.log("Notification object:", payload.notification);
            console.log("Data object:", payload.data);

            // Extract body from either notification or data object
            // Firebase may send it in different places depending on the SDK version
            let body = payload.notification?.body;
            if (!body) {
              body = payload.data?.body;
            }
            if (!body) {
              body = payload.data?.messageBody;
            }
            if (!body) {
              body = "";
            }

            let title = payload.notification?.title;
            if (!title) {
              title = payload.data?.title;
            }
            if (!title) {
              title = "Notification";
            }

            console.log("Extracted title:", title);
            console.log("Extracted body:", body);
            console.log("Body is empty?", body === "");
            console.log("Body is undefined?", body === undefined);
            console.log("Body type:", typeof body);

            const notification: FCMNotification = {
              notificationId: payload.data?.notificationId || `${Date.now()}`,
              type: payload.data?.type || "system_alert",
              title: title,
              body: body,
              image: payload.notification?.image || payload.data?.image,
              data: payload.data,
              actionUrl: payload.data?.actionUrl,
            };

            console.log("=== Final Notification Object ===");
            console.log("Title:", notification.title);
            console.log("Body:", notification.body);
            console.log("Full:", notification);

            setLastNotification(notification);

            // Trigger custom event for global notification listeners
            window.dispatchEvent(
              new CustomEvent("fcm-message", { detail: notification }),
            );
          });
        } else {
          throw new Error(result.error || "Failed to initialize FCM");
        }
      } catch (error) {
        console.error("FCM initialization error:", error);
        setState({
          isInitialized: false,
          isLoading: false,
          error: error instanceof Error ? error.message : "Unknown error",
          token: null,
        });
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      if (session?.user) {
        cleanupFCM(session.user.id);
      }
    };
  }, [session]);

  // Unregister FCM on logout
  useEffect(() => {
    if (!session && state.isInitialized && state.token) {
      // Session ended, cleanup is already done
      setState({
        isInitialized: false,
        isLoading: false,
        error: null,
        token: null,
      });
    }
  }, [session, state.isInitialized, state.token]);

  /**
   * Subscribe to topic
   */
  const subscribe = useCallback(
    async (topic: string) => {
      if (!session?.user) {
        console.error("User not authenticated");
        return { success: false };
      }

      return await subscribeTopic(session.user.id, topic);
    },
    [session],
  );

  /**
   * Unsubscribe from topic
   */
  const unsubscribe = useCallback(
    async (topic: string) => {
      if (!session?.user) {
        console.error("User not authenticated");
        return { success: false };
      }

      return await unsubscribeTopic(session.user.id, topic);
    },
    [session],
  );

  /**
   * Get stored token
   */
  const getToken = useCallback(() => {
    if (!session?.user) return null;
    return getStoredFCMToken(session.user.id);
  }, [session]);

  /**
   * Unregister and logout
   */
  const unregister = useCallback(async () => {
    if (!session?.user || !state.token) {
      return { success: false };
    }

    const result = await unregisterFCMToken(session.user.id, state.token);

    if (result.success) {
      setState({
        isInitialized: false,
        isLoading: false,
        error: null,
        token: null,
      });
    }

    return result;
  }, [session, state.token]);

  return {
    ...state,
    getToken,
    subscribe,
    unsubscribe,
    unregister,
    lastNotification,
  };
};

export default useFCM;
