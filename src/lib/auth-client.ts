import { createAuthClient } from "better-auth/react";
import { getBrowserPublicBaseUrl } from "@/lib/public-base-url";

function getBaseURL(): string {
  return getBrowserPublicBaseUrl();
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
