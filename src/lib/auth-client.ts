import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  basePath: "/api/v1/auth",
  // Ensure cookies are sent with requests (critical for production)
  fetchOptions: {
    credentials: "include", // Send cookies with cross-origin requests
  },
});

// Export auth methods for easy access
export const { signIn, signUp, signOut, useSession, getSession } = authClient;
