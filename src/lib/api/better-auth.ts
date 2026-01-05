// Better Auth setup for Next.js API routes
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import config from "./config";
import { logger } from "./logger";
import mongoose from "mongoose";

// Initialize Better Auth with MongoDB adapter
let auth: any = null;

// Function to initialize Better Auth (call after MongoDB connection)
export const initializeBetterAuth = async (): Promise<void> => {
  if (auth) {
    return; // Already initialized
  }

  if (!config.MONGO_URI) {
    logger.warn(
      "Better Auth: MONGO_URI not configured, skipping initialization"
    );
    return;
  }

  try {
    // Ensure Mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      // Try to connect if not already connected
      await mongoose.connect(config.MONGO_URI!, {
        dbName: "elkan-db",
        appName: "Elkan Next.js API",
      });
    }

    // Get the MongoDB database instance from Mongoose connection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error(
        "MongoDB database instance not available. Ensure Mongoose is connected."
      );
    }

    // Get MongoDB client for transactions support
    const client = mongoose.connection.getClient();

    auth = betterAuth({
      database: mongodbAdapter(db, {
        usePlural: true, // Use plural collection names (users, sessions, accounts, etc.)
        client: client, // Enable transactions
        // Map field names: MongoDB uses 'token', Better Auth expects 'sessionToken'
        // @ts-ignore - Type definitions may be outdated, but these options exist in runtime
        mapKeysTransformInput: {
          // When writing to DB: Better Auth sends 'sessionToken', store as 'token' in MongoDB
          sessionToken: "token",
        },
        // @ts-ignore - Type definitions may be outdated, but these options exist in runtime
        mapKeysTransformOutput: {
          // When reading from DB: MongoDB has 'token', return as 'sessionToken' to Better Auth
          token: "sessionToken",
        },
      }),
      secret:
        config.BETTER_AUTH_SECRET ||
        config.JWT_ACCESS_SECRET ||
        "your-secret-key",
      baseURL:
        config.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:3000",
      basePath: "/api/v1/auth",
      trustedOrigins: config.WHITELIST_ORIGINS,
      // Production cookie settings
      cookies: {
        sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        secure: config.NODE_ENV === "production",
        httpOnly: true,
        path: "/",
      },
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      emailVerification: {
        enabled: true,
        sendOnSignUp: true,
        // Custom email sending function
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
          maxAge: 60 * 5, // Cache for 5 minutes
        },
      },
      user: {
        additionalFields: {
          firstName: {
            type: "string",
            required: false,
          },
          lastName: {
            type: "string",
            required: false,
          },
          username: {
            type: "string",
            required: false,
            unique: true,
          },
          role: {
            type: "string",
            required: false,
            default: "learner",
          },
          isActive: {
            type: "boolean",
            required: false,
            default: true,
          },
          isEmailVerified: {
            type: "boolean",
            required: false,
            default: false,
          },
          avatar: {
            type: "string",
            required: false,
          },
          phone: {
            type: "string",
            required: false,
          },
          dateOfBirth: {
            type: "date",
            required: false,
          },
          lastLoginAt: {
            type: "date",
            required: false,
          },
        },
      },
    });
    logger.info("Better Auth initialized successfully");
  } catch (error: any) {
    logger.error("Better Auth initialization failed", {
      error: error.message,
      stack: error.stack,
    });
    auth = null;
  }
};

// Export auth client for use in routes
export { auth };
export type Auth = typeof auth;
