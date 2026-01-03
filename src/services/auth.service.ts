import { authClient } from "@/lib/auth-client";

// Use relative path for Next.js API routes
const AUTH_BASE_URL = "/api/v1/auth";

/**
 * Auth service for Better Auth operations
 * Uses Better Auth's standard API endpoints
 */
export const authService = {
  /**
   * Send email verification
   * Custom endpoint: POST /api/v1/auth/email/resend-verification
   */
  sendVerificationEmail: async () => {
    const response = await fetch(
      `${AUTH_BASE_URL}/email/resend-verification`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to send verification email" }));
      throw new Error(error.message || "Failed to send verification email");
    }

    return await response.json();
  },

  /**
   * Verify email with token
   * Better Auth endpoint: POST /api/v1/auth/email/verify-email
   */
  verifyEmail: async (token: string) => {
    const response = await fetch(
      `${AUTH_BASE_URL}/email/verify-email`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to verify email" }));
      throw new Error(error.message || "Failed to verify email");
    }

    return await response.json();
  },

  /**
   * Change password (requires current password)
   * Better Auth endpoint: POST /api/v1/auth/password/change
   */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await fetch(
      `${AUTH_BASE_URL}/password/change`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to change password" }));
      throw new Error(error.message || "Failed to change password");
    }

    return await response.json();
  },

  /**
   * Request password reset (forgot password)
   * Better Auth endpoint: POST /api/v1/auth/password/forgot-password
   */
  forgotPassword: async (email: string) => {
    const response = await fetch(
      `${AUTH_BASE_URL}/password/forgot-password`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to send reset email" }));
      throw new Error(error.message || "Failed to send reset email");
    }

    return await response.json();
  },

  /**
   * Reset password with token
   * Better Auth endpoint: POST /api/v1/auth/password/reset-password
   */
  resetPassword: async (token: string, newPassword: string) => {
    const response = await fetch(
      `${AUTH_BASE_URL}/password/reset-password`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to reset password" }));
      throw new Error(error.message || "Failed to reset password");
    }

    return await response.json();
  },
};

