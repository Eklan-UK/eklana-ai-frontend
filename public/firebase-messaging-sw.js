// Firebase Cloud Messaging Service Worker
// This file handles FCM push events and displays notifications

importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js",
);

// Initialize Firebase in Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDh5kqZATGR5j0LiOwhXlj9SPx0xqFLKHw",
  authDomain: "facebook-48028.firebaseapp.com",
  projectId: "facebook-48028",
  storageBucket: "facebook-48028.appspot.com",
  messagingSenderId: "1032933313606",
  appId: "1:1032933313606:web:5f68a74f7b1be2076a3ccd",
});

const messaging = firebase.messaging();

// Handle background message
messaging.onBackgroundMessage((payload) => {
  console.log("=== SERVICE WORKER: Background Message ===");
  console.log("Full payload:", payload);
  console.log("Notification:", payload.notification);
  console.log("Data:", payload.data);

  // Extract notification data
  const notificationTitle =
    payload.notification?.title || payload.data?.title || "Notification";
  const notificationBody =
    payload.notification?.body || payload.data?.body || "New message";
  const notificationImage = payload.notification?.image || payload.data?.image;

  console.log("Final Title:", notificationTitle);
  console.log("Final Body:", notificationBody);
  console.log("Final Image:", notificationImage);

  const notificationOptions = {
    body: notificationBody,
    icon: "/icons/favicon-192x192.png",
    badge: "/icons/badge-72x72.png",
    image: notificationImage,
    tag: payload.data?.type || "notification",
    data: {
      notificationId: payload.data?.notificationId,
      type: payload.data?.type,
      actionUrl: payload.data?.actionUrl,
    },
    actions: [
      {
        action: "open",
        title: "Open",
      },
      {
        action: "close",
        title: "Close",
      },
    ],
  };

  console.log("Showing notification with options:", notificationOptions);

  // Display the notification
  return self.registration.showNotification(
    notificationTitle,
    notificationOptions,
  );
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);
  event.notification.close();

  const urlToOpen = event.notification.data?.actionUrl || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if app is already open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen || client.url === urlToOpen + "/") {
            return client.focus();
          }
        }
        // If not open, open the app
        return clients.openWindow(urlToOpen);
      }),
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event);
});
