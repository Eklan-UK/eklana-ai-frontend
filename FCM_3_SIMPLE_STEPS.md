# ⚡ FCM Setup - 3 Simple Steps

## Step 1️⃣: Get Firebase Service Account (5 minutes)

### a) Open Firebase Console
- Go to: https://console.firebase.google.com/
- Select project: **facebook-48028**

### b) Navigate to Service Accounts
- Click Settings ⚙️ (gear icon)
- Click **Project Settings**
- Go to **Service Accounts** tab
- Find **Firebase Admin SDK** section

### c) Generate Private Key
- Click **Generate New Private Key**
- A JSON file will download (e.g., `facebook-48028-xxxxx.json`)
- This is your credentials file - keep it secure!

---

## Step 2️⃣: Add to .env.local (5 minutes)

### a) Copy the JSON content
- Open the downloaded JSON file
- Copy **the entire contents** (it's a large string)

### b) Minify to single line
- Use one of these tools:
  - **Online:** https://jsoncrush.com/
  - **Command:** `jq -c < file.json`
  - **Python:** `python3 -c "import json; print(json.dumps(json.load(open('file.json')))"` 

### c) Add to .env.local
Edit `/home/lord/Elkan-project/front-end/.env.local` and add:

```bash
FIREBASE_SERVICE_ACCOUNT='<paste_minified_json_here>'
```

**Example (truncated):**
```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"facebook-48028","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-xxxxx@facebook-48028.iam.gserviceaccount.com",...}'
```

**IMPORTANT:**
- Must be on ONE line
- Must be inside single quotes `'...'`
- Must start with `{` and end with `}`

---

## Step 3️⃣: Restart & Test (5 minutes)

### a) Stop & restart dev server
```bash
# Press Ctrl+C to stop current server
# Then restart:
npm run dev
```

### b) Test token registration
```bash
# Open http://localhost:3000
# Login as a user
# Grant notification permission when asked
# Check MongoDB:

mongosh localhost:27017/eklan-ai
db.fcmtokens.find({ isActive: true }).pretty()

# Should see documents like:
# {
#   userId: ObjectId(...),
#   token: "dGxxx...",
#   isActive: true,
#   registeredAt: ISODate(...)
# }
```

### c) Test notification
```bash
# Open http://localhost:3000/admin/dashboard (as admin)
# Click blue "Test Notification" button
# Should see: "Test notification sent to X device(s)"
```

---

## ✅ Verification Checklist

After these 3 steps, verify everything:

- [ ] Service account JSON downloaded
- [ ] FIREBASE_SERVICE_ACCOUNT added to .env.local (single line)
- [ ] Dev server restarted
- [ ] User logged in
- [ ] Notification permission granted
- [ ] Token visible in MongoDB
- [ ] Server console shows: "✅ Firebase Admin SDK initialized successfully"
- [ ] Admin can click "Test Notification"
- [ ] Toast shows: "Test notification sent to X device(s)"
- [ ] Notification appears in UI (bottom-right corner)

---

## 🆘 Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT environment variable is not set"
**Solution:** Make sure you added it to .env.local and restarted dev server

### Error: "Service account object must contain a string 'project_id' property"
**Solution:** 
- Verify JSON is valid (use jsonlint.com)
- Ensure it's minified to ONE line
- Check that it includes `"project_id":"facebook-48028"`

### No token in MongoDB
**Solution:**
- Make sure notification permission was granted
- Check browser console (F12) for error messages
- Clear browser cache and try again

### Admin button shows no notification
**Solution:**
- Check server console for error messages
- Verify at least one token exists in MongoDB
- Check that app is running in development mode

---

## 📚 Full Documentation

For detailed information, see these guides:
- **FCM_COMPLETE_SETUP_GUIDE.md** - 500+ line detailed guide
- **FCM_STATUS_SUMMARY.md** - Current implementation status
- **FCM_QUICK_FIX.md** - Summary of today's fixes

---

## ⏱️ Estimated Time: 15 minutes total

- Get service account: 5 min
- Add to .env.local: 5 min  
- Test & verify: 5 min

**Then FCM is fully functional!** 🎉

---

**Questions?** Check FCM_COMPLETE_SETUP_GUIDE.md for detailed step-by-step instructions with screenshots and troubleshooting.
