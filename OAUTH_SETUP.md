# OAuth Setup Guide

## Google OAuth Redirect URI Configuration

Better Auth constructs the OAuth callback URL using this format:
```
{baseURL}/api/v1/auth/callback/{provider}
```

For Google OAuth, the redirect URI is:
```
{baseURL}/api/v1/auth/callback/google
```

### Determining Your baseURL

The `baseURL` is determined in this order:
1. `BETTER_AUTH_URL` environment variable
2. `NEXT_PUBLIC_API_URL` environment variable
3. `VERCEL_URL` (automatically prefixed with `https://`)
4. `NEXT_PUBLIC_VERCEL_URL` environment variable
5. Default: `http://localhost:3000` (development)

### Required Redirect URIs

You **MUST** add these redirect URIs to your **Google Cloud Console** (not Firebase Console):

#### For Development:
```
http://localhost:3000/api/v1/auth/callback/google
```

#### For Production:
```
https://yourdomain.com/api/v1/auth/callback/google
```

Replace `yourdomain.com` with your actual production domain.

### Setting Up Google OAuth Credentials

1. **Go to Google Cloud Console** (not Firebase Console):
   - Visit: https://console.cloud.google.com/
   - Select your project (or create a new one)

2. **Enable Google+ API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: Your app name
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs** (CRITICAL - must match exactly):
     - `http://localhost:3000/api/v1/auth/callback/google` (development)
     - `https://yourdomain.com/api/v1/auth/callback/google` (production)

4. **Copy Credentials**:
   - Copy the **Client ID** → Set as `GOOGLE_CLIENT_ID` in your `.env`
   - Copy the **Client Secret** → Set as `GOOGLE_CLIENT_SECRET` in your `.env`

### Environment Variables

Add these to your `.env.local` or `.env` file:

```env
# OAuth Credentials (from Google Cloud Console, NOT Firebase)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Base URL (for OAuth redirect URI construction)
BETTER_AUTH_URL=http://localhost:3000  # Development
# OR
BETTER_AUTH_URL=https://yourdomain.com  # Production

# Alternative (if BETTER_AUTH_URL is not set)
NEXT_PUBLIC_API_URL=http://localhost:3000  # Development
# OR
NEXT_PUBLIC_API_URL=https://yourdomain.com  # Production
```

### Important Notes

⚠️ **Do NOT use Firebase Authentication credentials** - Better Auth requires **Google Cloud Console OAuth 2.0 credentials**.

⚠️ **The redirect URI must match EXACTLY** - including:
- Protocol (`http://` vs `https://`)
- Domain (no trailing slash)
- Path (`/api/v1/auth/callback/google`)
- Case sensitivity

⚠️ **Common Mistakes**:
- Using Firebase credentials instead of Google Cloud Console credentials
- Missing `/api/v1/auth/callback/google` path
- Using `http://` in production (should be `https://`)
- Trailing slashes in redirect URI
- Wrong domain/port

### Testing

1. Start your development server: `yarn dev`
2. Navigate to login page
3. Click "Sign in with Google"
4. You should be redirected to Google's consent screen
5. After consent, you should be redirected back to `/auth/callback`

### Troubleshooting

**Error: `redirect_uri_mismatch`**
- Verify the redirect URI in Google Cloud Console matches exactly: `{baseURL}/api/v1/auth/callback/google`
- Check your `BETTER_AUTH_URL` or `NEXT_PUBLIC_API_URL` environment variable
- Ensure protocol matches (`http://` for dev, `https://` for prod)
- No trailing slashes

**Error: `invalid_client`**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure you're using Google Cloud Console credentials, not Firebase credentials
- Check that credentials are from the correct Google Cloud project

**OAuth flow starts but fails**
- Check server logs for Better Auth errors
- Verify database connection (Better Auth needs MongoDB)
- Check that `BETTER_AUTH_SECRET` is set

### Verifying Your Configuration

To see what redirect URI Better Auth is using, check your server logs when initializing Better Auth. You should see:
```
Initializing Better Auth { baseURL: 'http://localhost:3000', ... }
```

The redirect URI will be: `{baseURL}/api/v1/auth/callback/google`

