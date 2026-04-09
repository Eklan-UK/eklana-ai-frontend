// lib/api/better-auth.ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import config, { parseWhitelistOrigins } from "./config";
import { logger } from "./logger";
import { connectToDatabase } from "./db";
import { getPublicBaseUrlFallback } from "@/lib/public-base-url";

// Cache auth instance globally
let authInstance: any = null;

export const getAuth = async () => {
  // Return cached instance
  if (authInstance) {
    return authInstance;
  }

  try {
    // Connect to database (uses cached connection)
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB database instance not available");
    }

    // Runtime per deployment (BETTER_AUTH_URL first in getPublicBaseUrlFallback); do not
    // assume a single NEXT_PUBLIC_* host baked at build time.
    const baseURL = getPublicBaseUrlFallback();

    // Session cookies: never tie Secure solely to NODE_ENV (staging/prod builds are always
    // "production" even over HTTP). Use HTTPS from baseURL or explicit COOKIE_SECURE.
    const cookieSecureRaw = process.env.COOKIE_SECURE?.trim().toLowerCase();
    let secureCookies = baseURL.startsWith("https://");
    if (cookieSecureRaw === "true") secureCookies = true;
    if (cookieSecureRaw === "false") secureCookies = false;

    // Same-origin app: Lax + Secure on HTTPS is enough; None is for cross-site embeds.
    const sessionSameSite: "lax" | "none" = "lax";

    // Better Auth CORS / CSRF: origins from WHITELIST_ORIGINS (comma-separated) via parseWhitelistOrigins()
    const trustedOrigins = [...parseWhitelistOrigins()];
    if (baseURL && !trustedOrigins.includes(baseURL)) {
      trustedOrigins.push(baseURL);
    }
    
    // Add mobile app redirect URIs to trusted origins
    // These are needed for OAuth callbacks from mobile apps
    const mobileOrigins = [
      'elkan://', // Custom scheme for production
      'exp://', // Expo development scheme
    ];
    mobileOrigins.forEach(origin => {
      if (!trustedOrigins.includes(origin)) {
        trustedOrigins.push(origin);
      }
    });

    // Calculate the OAuth redirect URI for logging/debugging
    const oauthRedirectURI = `${baseURL}/api/v1/auth/callback/google`;
    
    logger.info("Initializing Better Auth", {
      baseURL,
      trustedOrigins,
      oauthRedirectURI: "Google OAuth redirect URI: " + oauthRedirectURI,
      note: "Make sure this exact URI is registered in Google Cloud Console",
      sessionCookie: { secure: secureCookies, sameSite: sessionSameSite },
    });

    // Create and cache Better Auth instance
    authInstance = betterAuth({
      database: mongodbAdapter(db, {
        usePlural: true,
        client: mongoose.connection.getClient(),
      }),
      secret: config.BETTER_AUTH_SECRET || config.JWT_ACCESS_SECRET,
      baseURL,
      basePath: "/api/v1/auth",
      trustedOrigins,

      advanced: {
        generateId: () => crypto.randomUUID(),
        crossSubDomainCookies: {
          enabled: true,
        },
      },

      cookies: {
        sameSite: sessionSameSite,
        secure: secureCookies,
        httpOnly: true,
        path: "/",
      },

      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true, // Require email verification
      },

      emailVerification: {
        enabled: true,
        sendOnSignUp: true,
        async sendVerificationEmail({ user, url, token }) {
          const { sendEmailVerification } = await import("./email.service");
          await sendEmailVerification({
            email: user.email,
            name: user.name || "User",
            verificationLink: url,
          });
        },
      },

      forgotPassword: {
        enabled: true,
      },

      socialProviders: {
        google: {
          clientId: config.GOOGLE_CLIENT_ID || "",
          clientSecret: config.GOOGLE_CLIENT_SECRET || "",
          scope: ["openid", "profile", "email"],
          enabled: !!config.GOOGLE_CLIENT_ID && !!config.GOOGLE_CLIENT_SECRET,
        },
        apple: {
          clientId: config.APPLE_CLIENT_ID || "",
          clientSecret: config.APPLE_CLIENT_SECRET || "",
          enabled: !!(config.APPLE_CLIENT_ID && config.APPLE_CLIENT_SECRET),
        },
      },

      session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days for "remember me" functionality
        updateAge: 60 * 60 * 24, // 1 day
        cookieCache: {
          enabled: true,
          maxAge: 60 * 5,
        },
      },

      user: {
        additionalFields: {
          firstName: { type: "string", required: true },
          lastName: { type: "string", required: true },
          username: { type: "string", required: false, unique: true },
          role: { type: "string", required: false },
          isActive: { type: "boolean", required: false, default: true },
          isEmailVerified: { type: "boolean", required: false, default: false },
          avatar: { type: "string", required: false },
          phone: { type: "string", required: false },
          dateOfBirth: { type: "date", required: false },
          lastLoginAt: { type: "date", required: false },
          hasProfile: { type: "boolean", required: false, default: false },
        },
      },
    });

    logger.info("Better Auth initialized successfully");
    return authInstance;
  } catch (error: any) {
    logger.error("Better Auth initialization failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export type Auth = Awaited<ReturnType<typeof getAuth>>;
