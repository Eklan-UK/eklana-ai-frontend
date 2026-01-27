/**
 * FCM Notification Listener Component
 * Listens for FCM messages and displays notifications in the UI
 */

"use client";

import { useEffect, useState } from "react";
import useFCM from "@/hooks/useFCM";

interface Notification {
  id: string;
  notificationId: string;
  type: string;
  title: string;
  body: string;
  image?: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
}

export const FCMNotificationListener = () => {
  const { isInitialized, lastNotification } = useFCM();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Listen for foreground FCM messages
  useEffect(() => {
    const handleFCMMessage = (event: CustomEvent) => {
      const notification = event.detail;
      console.log("Received FCM notification:", notification);

      // Add notification to state
      const newNotification: Notification = {
        id: `${Date.now()}`,
        notificationId: notification.notificationId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        image: notification.image,
        timestamp: new Date(),
        isRead: false,
        actionUrl: notification.actionUrl,
      };

      setNotifications((prev) => [newNotification, ...prev]);

      // Show browser notification (fallback)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(notification.title, {
          body: notification.body,
          icon: "/icons/favicon-192x192.png",
          badge: "/icons/badge-72x72.png",
          tag: notification.type,
          data: {
            actionUrl: notification.actionUrl,
            notificationId: notification.notificationId,
          },
        });
      }

      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== newNotification.id),
        );
      }, 5000);
    };

    window.addEventListener("fcm-message", handleFCMMessage as EventListener);

    return () => {
      window.removeEventListener(
        "fcm-message",
        handleFCMMessage as EventListener,
      );
    };
  }, []);

  // Handle notification actions (from service worker)
  useEffect(() => {
    if (!navigator.serviceWorker) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data.type === "NOTIFICATION_ACTION") {
        const { action, notification } = event.data.data;
        console.log("Notification action triggered:", action);

        // Handle specific actions
        switch (action) {
          case "open":
            if (notification.actionUrl) {
              window.location.href = notification.actionUrl;
            }
            break;
          case "dismiss":
            // Already handled by service worker
            break;
          default:
            console.log("Unknown action:", action);
        }
      }
    };

    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    };
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
    );
  };

  const dismiss = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  if (!isInitialized || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm hover:shadow-xl transition-shadow"
        >
          {notification.image && (
            <img
              src={notification.image}
              alt={notification.title}
              className="w-full h-32 object-cover rounded mb-2"
            />
          )}
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {notification.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
              {notification.actionUrl && (
                <a
                  href={notification.actionUrl}
                  className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  onClick={() => markAsRead(notification.id)}
                >
                  View →
                </a>
              )}
            </div>
            <button
              onClick={() => dismiss(notification.id)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      {notifications.length > 3 && (
        <button
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-gray-700 mx-auto block"
        >
          Clear all
        </button>
      )}
    </div>
  );
};

export default FCMNotificationListener;
