// lib/api/better-auth.ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import config, { parseWhitelistOrigins } from "./config";
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
      note: "Make sure this exact URI is registered in Google Cloud Console"
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
        sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        secure: config.NODE_ENV === "production",
        httpOnly: true,
        path: "/",
      },

      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // Allow login without email verification; prompt later on profile screen
      },

      emailVerification: {
        enabled: true,
        sendOnSignUp: false, // Mobile uses OTP-based verification; web can trigger manually
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
          role: { type: "string", required: false, defaultValue: "user" },
          isActive: { type: "boolean", required: false, default: true },
          isEmailVerified: { type: "boolean", required: false, default: false },
          avatar: { type: "string", required: false },
          phone: { type: "string", required: false },
          dateOfBirth: { type: "date", required: false },
          lastLoginAt: { type: "date", required: false },
          hasProfile: { type: "boolean", required: false, default: false },
        },
      },

      databaseHooks: {
        user: {
          create: {
            after: async (user: any) => {
              // Belt-and-suspenders: ensure role is always set to 'user' for new signups.
              // Better Auth's MongoDB adapter bypasses Mongoose schema defaults, so
              // we patch the document here if role is somehow still missing.
              if (!user.role) {
                try {
                  await connectToDatabase();
                  const UserModel = (await import("@/models/user")).default;
                  await UserModel.updateOne(
                    { _id: user.id },
                    { $set: { role: "user" } }
                  );
                  logger.info("databaseHook: set default role for new user", {
                    userId: user.id,
                    email: user.email,
                  });
                } catch (err: any) {
                  logger.error("databaseHook: failed to set default role", {
                    error: err.message,
                    userId: user.id,
                  });
                }
              }
            },
          },
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
