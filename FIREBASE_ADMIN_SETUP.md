# Firebase Admin SDK Setup Guide

## Required: Service Account Credentials

The Firebase Admin SDK needs your Firebase service account JSON credentials. Follow these steps:

### Step 1: Get Your Service Account Key from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `facebook-48028`
3. Click **Settings** (gear icon) → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. A JSON file will download - this is your service account key
7. Keep this file secure and don't commit it to version control

### Step 2: Add to .env.local

The service account JSON needs to be converted to a single-line string and added to `.env.local`:

```bash
# Option A: If your service account JSON looks like:
# {
#   "type": "service_account",
#   "project_id": "facebook-48028",
#   "private_key_id": "...",
#   ...
# }

# Add this single line to .env.local (replace with your actual JSON):
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"facebook-48028","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'
```

**Important:** Make sure it's all on ONE line with no line breaks.

### Step 3: Verify Setup

1. Restart your dev server: `npm run dev`
2. Try the test notification again
3. Check server console for: "Firebase Admin SDK initialized successfully"

## Alternative: Using GOOGLE_APPLICATION_CREDENTIALS (Google Cloud)

If you're deploying to Google Cloud Platform:

1. Set environment variable: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json`
2. Firebase Admin SDK will automatically use it

## Troubleshooting

### Error: "Service account object must contain a string 'project_id' property"

**Cause:** The JSON is malformed or missing required fields

**Solution:**
- Verify the JSON is valid (use jsonlint.com)
- Ensure it's a single line in `.env.local`
- Check that `project_id` field exists and matches `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

### Error: "sendMulticast is not a function"

**Cause:** Firebase Admin SDK version compatibility issue

**Solution:**
- This should be fixed with `firebase-admin@12.0.0+`
- Run: `npm list firebase-admin` to check version
- If needed, reinstall: `npm install --save firebase-admin@latest`

### Error: "messaging() is not available"

**Cause:** Firebase Admin SDK not initialized properly

**Solution:**
1. Check `FIREBASE_SERVICE_ACCOUNT` is in `.env.local`
2. Verify it's a valid JSON string
3. Check server logs for initialization errors
4. Restart dev server

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `FIREBASE_SERVICE_ACCOUNT` to git
- Never share the service account JSON with anyone
- Use `.gitignore` to exclude `.env.local`
- In production, use Google Cloud IAM roles instead of service accounts

## Testing the Setup

Once configured, the test flow should work:

```
User logs in → FCM token registered → Admin sends test notification → User sees notification
```

If you see: `"Firebase Admin SDK initialized successfully"` in server logs, the setup is correct.

---

**Need Help?**
Check the Firebase Console Service Accounts tab to re-generate a new key if needed.
