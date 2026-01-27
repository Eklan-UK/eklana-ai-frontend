# Complete FCM Implementation Setup - Step by Step

## Phase 1: Firebase Project Setup (One-time)

### Step 1.1: Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. You should see your project: **facebook-48028**
3. Click on it to open the project

### Step 1.2: Enable Cloud Messaging

1. In Firebase Console, go to **Build** section (left sidebar)
2. Click **Cloud Messaging**
3. If not enabled, click **Enable**
4. You should see:
   - **Server API Key** (NEXT_PUBLIC_FIREBASE_API_KEY) ✓ Already in .env.local
   - **Sender ID** (NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ✓ Already in .env.local

### Step 1.3: Get Service Account Credentials

1. In Firebase Console, click **Settings** (gear icon) → **Project Settings**
2. Go to the **Service Accounts** tab
3. Under **Firebase Admin SDK**, select **Node.js**
4. Click **Generate New Private Key**
5. A JSON file will automatically download (usually named like `facebook-48028-xxxxx.json`)
6. **DO NOT commit this file to git** - it's a secret credential

### Step 1.4: Extract Service Account JSON

Open the downloaded JSON file and copy the entire contents. It will look like:

```json
{
  "type": "service_account",
  "project_id": "facebook-48028",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@facebook-48028.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40facebook-48028.iam.gserviceaccount.com"
}
```

## Phase 2: Environment Configuration

### Step 2.1: Convert JSON to Single Line

The JSON must be on a single line in `.env.local`. You can use an online tool or command:

**Option A: Using jq (if installed)**
```bash
# If you have jq installed
cat ~/Downloads/facebook-48028-xxxxx.json | jq -c . > service-account-minified.json
# Then copy the content
cat service-account-minified.json
```

**Option B: Using Python**
```bash
python3 -c "import json; print(json.dumps(json.load(open('~/Downloads/facebook-48028-xxxxx.json'))))"
```

**Option C: Manual**
- Use [jsoncrush.com](https://jsoncrush.com/) or [minifier.org](https://www.minifier.org/json)
- Paste the JSON and it will minify to one line

### Step 2.2: Add to .env.local

Edit `/home/lord/Elkan-project/front-end/.env.local` and add:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"facebook-48028","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIEvQ...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-xxxxx@facebook-48028.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40facebook-48028.iam.gserviceaccount.com"}'
```

**Important Notes:**
- Everything must be on ONE line
- Include the outer single quotes `'...'`
- Replace the `...` with your actual values from the JSON
- Make sure `project_id` is `facebook-48028`

### Step 2.3: Restart Dev Server

```bash
# Stop current dev server (Ctrl+C)
# Then restart it
npm run dev
```

## Phase 3: FCM Token Registration Testing

### Step 3.1: Clear Browser Cache

Before testing, clear browser cache to ensure fresh FCM initialization:

**In Chrome/Edge:**
- Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Select "All time"
- Check: Cookies, Site data, Cached images
- Click "Clear data"

### Step 3.2: Test Token Registration

1. **Open the app:** `http://localhost:3000`
2. **Login as a user** (or register new account)
3. **Grant notification permission** when browser prompts
4. **Check browser console** (F12 → Console):
   - Look for: ✅ `"FCM token registered successfully"`
   - Or: ✅ `"✅ Firebase Admin SDK initialized successfully"`

### Step 3.3: Verify Token in Database

Open MongoDB shell and check:

```bash
mongosh localhost:27017/eklan-ai

# Check if tokens collection has entries
db.fcmtokens.countDocuments({ isActive: true })

# View the tokens
db.fcmtokens.find({ isActive: true }).pretty()
```

Should see documents like:
```json
{
  "_id": ObjectId("..."),
  "userId": ObjectId("..."),
  "token": "dG...",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "platform": "Linux",
    "browser": "Google Inc."
  },
  "isActive": true,
  "registeredAt": ISODate("2026-01-23T16:20:00.000Z"),
  "lastSeenAt": ISODate("2026-01-23T16:20:00.000Z")
}
```

## Phase 4: Admin Dashboard Test Notification

### Step 4.1: Open Two Browser Tabs

**Tab 1 - User View:**
- URL: `http://localhost:3000`
- Logged in as regular user
- Keep DevTools open (F12 → Console)
- Watch for: `"FCM Message received"`

**Tab 2 - Admin View:**
- URL: `http://localhost:3000/admin/dashboard`
- Logged in as admin user
- Ready to send notifications

### Step 4.2: Send Test Notification

In Tab 2 (Admin):
1. Click the blue **"Test Notification"** button (top-right corner)
2. Watch for toast message: `"Test notification sent to X device(s)"`
3. Check server console for: ✅ `"Multicast message sent"`

### Step 4.3: Verify Notification Received

In Tab 1 (User):
1. Check console for: `"FCM Message received"`
2. Look for notification popup in **bottom-right corner**
3. Should show:
   - 🧪 **Title:** "Test Notification"
   - **Body:** "Testing notification - If you see this, FCM is working!"

## Troubleshooting

### Issue: "FIREBASE_SERVICE_ACCOUNT environment variable is not set"

**Solution:**
1. Verify `.env.local` has `FIREBASE_SERVICE_ACCOUNT` line
2. Ensure it's NOT wrapped in quotes on a separate line
3. Must be: `FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'`
4. Restart dev server: `npm run dev`

### Issue: "Service account object must contain a string 'project_id' property"

**Solution:**
1. Check that the JSON includes `"project_id":"facebook-48028"`
2. Verify the JSON is valid (use jsonlint.com)
3. Ensure it's on a single line in `.env.local`

### Issue: "Notification doesn't appear in browser"

**Checklist:**
1. User is logged in ✓
2. FCM token is registered in MongoDB ✓
3. Notification permission is granted (check address bar icon) ✓
4. Service Worker is registered (DevTools → Application → Service Workers) ✓
5. Check server console for errors ✓

### Issue: "502 Bad Gateway" or server error

**Solution:**
1. Check server console for error messages
2. Verify all required environment variables are set
3. Restart dev server
4. Check that MongoDB is running: `mongosh localhost:27017`

## Success Checklist

- [ ] Firebase service account JSON downloaded from Firebase Console
- [ ] `FIREBASE_SERVICE_ACCOUNT` added to `.env.local`
- [ ] Dev server restarted
- [ ] User logged in and notification permission granted
- [ ] FCM token visible in MongoDB: `db.fcmtokens.find()`
- [ ] Admin can click "Test Notification" button
- [ ] Notification toast appears: "Test notification sent to X device(s)"
- [ ] User sees notification popup
- [ ] Server logs show: "✅ Firebase Admin SDK initialized successfully"
- [ ] Server logs show: "Multicast message sent"

---

Once all these checks pass, FCM is fully functional and ready for integration with your app's business logic!

**Next Steps:**
1. Wire up notification triggers (lessons, assignments, achievements)
2. Add user notification preferences
3. Monitor FCM metrics in Firebase Console
4. Set up production Firebase project

---

**Last Updated:** January 23, 2026
