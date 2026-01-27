# FCM Setup and Configuration Guide

This guide covers the complete setup for Firebase Cloud Messaging (FCM) implementation in the Elkan AI frontend.

## Prerequisites

- Firebase project created at https://console.firebase.google.com
- Admin SDK service account JSON key
- Web app registered in Firebase Console

## Step 1: Firebase Project Setup

### 1.1 Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name (e.g., "Elkan-AI")
4. Accept the terms and create project

### 1.2 Register Web App

1. In Firebase Console, click the web app (</>) icon
2. Register your web app
3. Copy the Firebase config object - you'll need these values for `.env.local`

### 1.3 Create Service Account

1. Go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Copy the entire JSON content for `FIREBASE_SERVICE_ACCOUNT` env variable

### 1.4 Get VAPID Key

1. Go to Project Settings → Cloud Messaging tab
2. Under "Web Push certificates", click "Generate Key Pair"
3. Copy the public key for `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

## Step 2: Environment Variables

### 2.1 Create `.env.local`

Copy all Firebase credentials to your `.env.local` file:

```env
# Firebase Web App Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_public_vapid_key

# Firebase Admin SDK (Service Account)
FIREBASE_SERVICE_ACCOUNT={
  "type": "service_account",
  "project_id": "your_project_id",
  "private_key_id": "key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxx@your_project.iam.gserviceaccount.com",
  "client_id": "client_id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxx%40your_project.iam.gserviceaccount.com"
}
```

### 2.2 Validate Configuration

All variables are required. You can test with:

```bash
npm run build  # This will error if env vars are missing
```

## Step 3: Database Setup

### 3.1 MongoDB Collections

Ensure your MongoDB instance has the FCMToken collection. The migration will create it automatically on first write.

You can pre-create it with:

```javascript
db.createCollection("fcmtokens", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "token", "isActive"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        token: { bsonType: "string" },
        deviceInfo: {
          bsonType: "object",
          properties: {
            userAgent: { bsonType: "string" },
            platform: { bsonType: "string" },
            browser: { bsonType: "string" }
          }
        },
        registeredAt: { bsonType: "date" },
        lastSeenAt: { bsonType: "date" },
        deregisteredAt: { bsonType: "date" },
        isActive: { bsonType: "bool" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Create indexes
db.fcmtokens.createIndex({ userId: 1, isActive: 1 });
db.fcmtokens.createIndex({ token: 1 }, { unique: true });
db.fcmtokens.createIndex({ deregisteredAt: 1 }, { expireAfterSeconds: 5184000 });
```

## Step 4: Application Integration

### 4.1 Update Root Layout

Add the FCM notification listener to your root layout (`src/app/layout.tsx`):

```tsx
import FCMNotificationListener from '@/components/notifications/FCMNotificationListener';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Your existing layout components */}
        <FCMNotificationListener />
        {children}
      </body>
    </html>
  );
}
```

### 4.2 Update Protected Routes

For protected routes, the FCM hook will automatically initialize when a session is available.

The `useFCM()` hook provides:

```typescript
interface FCMState {
  isInitialized: boolean;    // Whether FCM is ready
  isLoading: boolean;         // Loading state
  error: string | null;       // Any initialization errors
  token: string | null;       // Current FCM token
}

interface FCMMethods {
  getToken(): string | null;  // Get stored token
  subscribe(topic: string);   // Subscribe to topic
  unsubscribe(topic: string); // Unsubscribe from topic
  unregister();              // Unregister on logout
}
```

### 4.3 Send Notifications from Backend

Use the FCM trigger service to send notifications:

```typescript
import { sendNotificationToUser, NotificationType } from '@/lib/fcm-trigger';

// Send to single user
await sendNotificationToUser(
  userId,
  fcmToken,
  {
    type: NotificationType.LESSON_REMINDER,
    title: 'Lesson Starting Soon',
    body: 'Your lesson starts in 10 minutes',
    actionUrl: '/lessons/123',
    data: {
      lessonId: '123',
      tutorId: '456',
    }
  }
);

// Send to multiple users
await sendNotificationToUsers(
  userIds,
  tokens,
  {
    type: NotificationType.SYSTEM_ALERT,
    title: 'Maintenance Notice',
    body: 'System maintenance scheduled for 2 AM',
  }
);

// Send to topic
await sendNotificationToTopic(
  'all-students',
  {
    type: NotificationType.GAMIFICATION_MILESTONE,
    title: 'New Challenge Available',
    body: 'Check out the new pronunciation challenge!',
    actionUrl: '/challenges/new',
  }
);
```

## Step 5: Testing

### 5.1 Manual Testing

1. Open the application in a browser
2. Allow notification permission when prompted
3. Check browser console for FCM initialization logs
4. Send a test notification via FCM API:

```bash
curl -X POST https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "FCM_TOKEN_HERE",
      "notification": {
        "title": "Test Notification",
        "body": "This is a test message"
      }
    }
  }'
```

### 5.2 Automated Testing

See `FCM_IMPLEMENTATION_TESTING.md` for comprehensive test cases.

## Step 6: Deployment

### 6.1 Production Checklist

- [ ] All environment variables set in production environment
- [ ] Service account JSON is secure and not exposed
- [ ] Firebase security rules configured
- [ ] Database indexes created
- [ ] Notification templates reviewed
- [ ] Error handling tested
- [ ] Rate limiting implemented if needed
- [ ] Monitoring and alerting configured

### 6.2 Firebase Security Rules

Set up Firestore security rules to protect token data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fcmTokens/{document=**} {
      // Only allow reads of own tokens
      allow read: if request.auth.uid == resource.data.userId;
      // Only allow writes from backend (service account)
      allow write: if request.auth.uid != null;
    }
  }
}
```

## Troubleshooting

### Issue: FCM Token Not Registering

**Solution:**
1. Check browser console for errors
2. Verify notification permission is granted
3. Check service worker is registered
4. Verify Firebase config variables are correct

### Issue: Messages Not Being Received

**Solution:**
1. Check FCM token is valid and active in database
2. Verify notification payload format
3. Check service worker is installed
4. Review browser notification settings
5. Check Firebase Cloud Messaging quota

### Issue: Service Worker Not Installing

**Solution:**
1. Verify `public/sw.js` exists
2. Check browser console for service worker errors
3. Ensure site is HTTPS (required for service workers)
4. Clear browser cache and cookies
5. Try accessing the app in a new incognito window

### Issue: "Firebase is not defined"

**Solution:**
1. Ensure Firebase SDK is properly imported in `src/lib/firebase.ts`
2. Check `NEXT_PUBLIC_FIREBASE_*` variables are set
3. Verify client code is marked with `'use client'`

## Architecture Overview

```
┌─────────────────────┐
│   Web Application   │
│   (React/Next.js)   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    v             v
┌────────┐  ┌──────────────┐
│Firebase│  │Service Worker│
│Client  │  │  (sw.js)     │
└────────┘  └──────────────┘
    │             │
    └──────┬──────┘
           │
      ┌────v────┐
      │   FCM   │
      │ Server  │
      └────┬────┘
           │
      ┌────v────────┐
      │ Push Queue  │
      │   (iOS)     │
      │  (Android)  │
      │  (Web)      │
      └─────────────┘
           │
      ┌────v────┐
      │ Devices │
      └─────────┘
```

## Next Steps

1. [FCM Architecture Overview](./FCM_ARCHITECTURE_DIAGRAMS.md)
2. [Implementation Guide](./FCM_IMPLEMENTATION_SUMMARY.md)
3. [Web Client Setup](./FCM_WEB_CLIENT_IMPLEMENTATION.md)
4. [Testing Guide](./FCM_IMPLEMENTATION_TESTING.md)
5. [Quick Start](./FCM_QUICK_START.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Firebase documentation
3. Check server logs for backend errors
4. Contact your development team
