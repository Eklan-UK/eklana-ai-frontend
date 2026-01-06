// lib/api/better-auth.ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import config from "./config";
import { logger } from "./logger";
import { connectToDatabase } from "./db";

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

    const baseURL =
      config.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined) ||
      "http://localhost:3000";

    const trustedOrigins = [...config.WHITELIST_ORIGINS];
    if (baseURL && !trustedOrigins.includes(baseURL)) {
      trustedOrigins.push(baseURL);
    }

    logger.info("Initializing Better Auth", { baseURL, trustedOrigins });

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
        sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        secure: config.NODE_ENV === "production",
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
          enabled: !!config.GOOGLE_CLIENT_ID && !!config.GOOGLE_CLIENT_SECRET,
        },
        apple: {
          clientId: config.APPLE_CLIENT_ID || "",
          clientSecret: config.APPLE_CLIENT_SECRET || "",
          enabled: !!(config.APPLE_CLIENT_ID && config.APPLE_CLIENT_SECRET),
        },
      },

      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
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
