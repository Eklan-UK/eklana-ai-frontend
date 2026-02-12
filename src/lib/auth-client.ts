import { createAuthClient } from "better-auth/react";

// Use the same baseURL logic as the server to ensure consistency
// This is critical for OAuth redirect URIs to match between client and server
function getBaseURL(): string {
  if (typeof window !== 'undefined') {
    // Client-side: prefer NEXT_PUBLIC_API_URL if set, otherwise use current origin
    // This ensures consistency with server-side Better Auth configuration
    const envBaseURL = process.env.NEXT_PUBLIC_API_URL;
    if (envBaseURL) {
      return envBaseURL;
    }
    return window.location.origin;
  }
  // Server-side: use environment variable
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: "/api/v1/auth",
  // Ensure cookies are sent with requests (critical for production)
  fetchOptions: {
    credentials: "include", // Send cookies with cross-origin requests
  },
});

// Export auth methods for easy access
export const { signIn, signUp, signOut, useSession, getSession } = authClient;
