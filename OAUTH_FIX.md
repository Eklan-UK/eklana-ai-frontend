# OAuth Redirect URI Mismatch Fix

## Problem
You're getting `Error 400: redirect_uri_mismatch` because the redirect URIs in Google Cloud Console don't match what Better Auth is actually sending.

## Solution

### Step 1: Check Your Current Redirect URI
Visit this endpoint to see the exact redirect URI Better Auth is using:
- **Local**: http://localhost:3000/api/v1/auth/debug-oauth
- **Production**: https://app.eklan.ai/api/v1/auth/debug-oauth

This will show you the exact redirect URI format.

### Step 2: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID named **"Eklan AI"**
4. Under **"Authorized redirect URIs"**, you currently have:
   - ❌ `https://app.eklan.ai/account`
   - ❌ `http://localhost:3000/account`

5. **Remove** the incorrect URIs above and **add** these exact URIs:
   - ✅ `https://app.eklan.ai/api/v1/auth/callback/google`
   - ✅ `http://localhost:3000/api/v1/auth/callback/google`

6. **Important**: The redirect URI must match EXACTLY:
   - Protocol: `https://` for production, `http://` for local
   - Domain: `app.eklan.ai` for production, `localhost:3000` for local
   - Path: `/api/v1/auth/callback/google` (NOT `/account`)

7. Click **Save**

### Step 3: Wait for Propagation
Google's changes can take **5 minutes to a few hours** to propagate. Be patient!

### Step 4: Verify Environment Variables (Optional but Recommended)

To ensure consistency between client and server, set these environment variables:

**For Production (.env.production or Vercel):**
```bash
NEXT_PUBLIC_API_URL=https://app.eklan.ai
BETTER_AUTH_URL=https://app.eklan.ai
```

**For Local Development (.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
```

This ensures both the client-side and server-side Better Auth use the same baseURL.

### Step 5: Test
1. Clear your browser cache/cookies
2. Try signing in with Google again
3. The redirect should now work!

## Why This Happened

Better Auth automatically constructs the OAuth redirect URI as:
```
${baseURL}${basePath}/callback/google
```

Where:
- `baseURL` = Your app's URL (e.g., `https://app.eklan.ai`)
- `basePath` = `/api/v1/auth` (configured in `better-auth.ts`)
- Result = `https://app.eklan.ai/api/v1/auth/callback/google`

The redirect URI in Google Cloud Console **must match this exactly**, including:
- Protocol (http/https)
- Domain
- Port (if any)
- Full path

## Troubleshooting

If you still get the error after updating:

1. **Double-check the exact redirect URI**:
   - Visit `/api/v1/auth/debug-oauth` to see what Better Auth is using
   - Compare it character-by-character with what's in Google Cloud Console

2. **Check for typos**:
   - No trailing slashes
   - Correct path: `/api/v1/auth/callback/google` (not `/account`)

3. **Wait longer**:
   - Google's changes can take up to a few hours to propagate

4. **Check multiple environments**:
   - Make sure you've added both production AND localhost URIs
   - Better Auth uses different URIs for different environments

5. **Verify environment variables**:
   - Make sure `NEXT_PUBLIC_API_URL` or `BETTER_AUTH_URL` is set correctly
   - The debug endpoint will show you what baseURL is being used







