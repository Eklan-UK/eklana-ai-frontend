/**
 * Firebase Admin SDK Configuration
 * Handles server-side FCM operations (sending messages, managing tokens)
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (admin.apps.length === 0) {
    try {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

      if (!serviceAccountJson) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT environment variable is not set. " +
            "Please add your Firebase service account JSON to .env.local. " +
            "See FIREBASE_ADMIN_SETUP.md for instructions.",
        );
      }

      const serviceAccount = JSON.parse(serviceAccountJson);

      if (!serviceAccount.project_id) {
        throw new Error(
          'Service account JSON is missing "project_id" field. ' +
            "Ensure you have the correct Firebase service account key.",
        );
      }

      admin.initializeApp({
        credential: admin.credential.cert(
          serviceAccount as admin.ServiceAccount,
        ),
        projectId: serviceAccount.project_id,
      });

      console.log("✅ Firebase Admin SDK initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing Firebase Admin SDK:", error);
      throw error;
    }
  }

  return admin;
};

/**
 * Send FCM message to single device
 */
export const sendToDevice = async (
  token: string,
  message: {
    notification?: {
      title: string;
      body: string;
      image?: string;
    };
    data?: Record<string, string>;
    webpush?: {
      notification?: {
        title: string;
        body: string;
        icon: string;
        badge: string;
        tag: string;
        color: string;
      };
      fcmOptions?: {
        link: string;
      };
    };
  },
) => {
  try {
    const fcm = initializeFirebaseAdmin();
    const messaging = fcm.messaging();

    // Ensure all data values are strings (Firebase requirement)
    const stringData: Record<string, string> = {};
    if (message.data) {
      for (const [key, value] of Object.entries(message.data)) {
        stringData[key] = String(value);
      }
    }

    const response = await messaging.send({
      token,
      notification: message.notification,
      data: stringData,
      webpush: message.webpush,
    });

    console.log("Message sent successfully:", response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending message to device:", error);
    throw error;
  }
};

/**
 * Send FCM message to multiple devices
 */
export const sendMulticast = async (
  tokens: string[],
  message: {
    notification?: {
      title: string;
      body: string;
      image?: string;
    };
    data?: Record<string, string>;
    webpush?: {
      notification?: {
        title: string;
        body: string;
        icon: string;
        badge: string;
        tag: string;
        color: string;
      };
      fcmOptions?: {
        link: string;
      };
    };
  },
) => {
  try {
    const fcm = initializeFirebaseAdmin();
    const messaging = fcm.messaging();

    let successCount = 0;
    let failureCount = 0;
    const responses: Array<{
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    // Send to each token individually and track results
    for (const token of tokens) {
      try {
        // Ensure all data values are strings (Firebase requirement)
        const stringData: Record<string, string> = {};
        if (message.data) {
          for (const [key, value] of Object.entries(message.data)) {
            stringData[key] = String(value);
          }
        }

        const messageId = await messaging.send({
          token,
          notification: message.notification,
          data: stringData,
          webpush: message.webpush,
        });

        successCount++;
        responses.push({ success: true, messageId });
      } catch (error) {
        failureCount++;
        responses.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log("Multicast message sent:", {
      success: successCount,
      failure: failureCount,
    });

    return {
      successCount,
      failureCount,
      responses,
    };
  } catch (error) {
    console.error("Error sending multicast message:", error);
    throw error;
  }
};

/**
 * Send FCM message to topic
 */
export const sendToTopic = async (
  topic: string,
  message: {
    notification?: {
      title: string;
      body: string;
      image?: string;
    };
    data?: Record<string, string>;
    webpush?: {
      notification?: {
        title: string;
        body: string;
        icon: string;
        badge: string;
        tag: string;
        color: string;
      };
      fcmOptions?: {
        link: string;
      };
    };
  },
) => {
  try {
    const fcm = initializeFirebaseAdmin();
    const messaging = fcm.messaging();

    const response = await messaging.send({
      topic,
      notification: message.notification,
      data: message.data,
      webpush: message.webpush,
    });

    console.log("Message sent to topic:", response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending message to topic:", error);
    throw error;
  }
};

/**
 * Subscribe device to topic
 */
export const subscribeToTopic = async (tokens: string[], topic: string) => {
  try {
    const fcm = initializeFirebaseAdmin();
    const messaging = fcm.messaging();

    const response = await messaging.subscribeToTopic(tokens, topic);

    console.log(`Subscribed ${tokens.length} devices to topic: ${topic}`);
    return response;
  } catch (error) {
    console.error("Error subscribing to topic:", error);
    throw error;
  }
};

/**
 * Unsubscribe device from topic
 */
export const unsubscribeFromTopic = async (tokens: string[], topic: string) => {
  try {
    const fcm = initializeFirebaseAdmin();
    const messaging = fcm.messaging();

    const response = await messaging.unsubscribeFromTopic(tokens, topic);

    console.log(`Unsubscribed ${tokens.length} devices from topic: ${topic}`);
    return response;
  } catch (error) {
    console.error("Error unsubscribing from topic:", error);
    throw error;
  }
};

/**
 * Send message to all devices with condition
 * Example: "'topic1' in topics && 'topic2' in topics"
 */
export const sendToCondition = async (
  condition: string,
  message: {
    notification?: {
      title: string;
      body: string;
      image?: string;
    };
    data?: Record<string, string>;
    webpush?: {
      notification?: {
        title: string;
        body: string;
        icon: string;
        badge: string;
        tag: string;
        color: string;
      };
      fcmOptions?: {
        link: string;
      };
    };
  },
) => {
  try {
    const fcm = initializeFirebaseAdmin();
    const messaging = fcm.messaging();

    const response = await messaging.send({
      condition,
      notification: message.notification,
      data: message.data,
      webpush: message.webpush,
    });

    console.log("Message sent to condition:", response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending message to condition:", error);
    throw error;
  }
};

export const getFirebaseAdmin = () => initializeFirebaseAdmin();

export default {
  sendToDevice,
  sendMulticast,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendToCondition,
  getFirebaseAdmin,
};
