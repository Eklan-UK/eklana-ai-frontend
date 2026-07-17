import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";
import mongoose from "mongoose";
import { getAuth } from "@/lib/api/better-auth";
import { logger } from "@/lib/api/logger";
import { connectToDatabase } from "@/lib/api/db";
import config, { parseGoogleClientIds } from "@/lib/api/config";
import { toRawUserIdFilter } from "@/lib/api/user-id";

// Cached at module scope so the JWKSet object (and jose's internal key
// cache) is reused across requests instead of being recreated every call.
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserInfo {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  sub: string; // User ID from provider
}

/**
 * Verify Google ID token
 */
async function verifyGoogleIdToken(idToken: string): Promise<UserInfo> {
  // GOOGLE_CLIENT_IDS env is a comma-separated string; split + trim in parseGoogleClientIds()
  const audiences = parseGoogleClientIds();
  const client = new OAuth2Client(audiences[0]);

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences,
    });
    
    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error("Invalid Google ID token payload");
    }

    if (!payload.email) {
      throw new Error("Google ID token missing email");
    }

    return {
      email: payload.email,
      name: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
      picture: payload.picture,
      sub: payload.sub,
    };
  } catch (error: any) {
    logger.error("Google ID token verification failed", { error: error.message });
    throw new Error(`Google token verification failed: ${error.message}`);
  }
}

/**
 * Verify Apple ID token
 *
 * Verifies the token's signature against Apple's public JWKS
 * (https://appleid.apple.com/auth/keys), and checks issuer/audience/expiry,
 * rather than blindly trusting a client-supplied, unverified JWT.
 */
async function verifyAppleIdToken(idToken: string): Promise<UserInfo> {
  try {
    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: config.APPLE_BUNDLE_ID,
    });

    const decoded = payload as any;

    if (!decoded.sub) {
      throw new Error("Invalid Apple ID token: missing sub claim");
    }

    // Apple only includes `email` on the user's very first sign-in with this
    // app; subsequent sign-ins omit it entirely. There is no real address to
    // fall back to here, so we use a clearly-internal placeholder (never a
    // genuine Apple "Hide My Email" relay address, and never a real user
    // email) purely so downstream code that expects a non-empty `email`
    // string keeps working. Account lookup prefers (provider, sub) over
    // email, so this only matters for the first-touch edge case.
    const email = decoded.email || `apple.${decoded.sub}@users.internal.eklan.ai`;

    return {
      email,
      name: decoded.name ? `${decoded.name.givenName || ''} ${decoded.name.familyName || ''}`.trim() : undefined,
      firstName: decoded.name?.givenName,
      lastName: decoded.name?.familyName,
      sub: decoded.sub,
    };
  } catch (error: any) {
    logger.error("Apple ID token verification failed", { error: error.message });
    throw new Error(`Apple token verification failed: ${error.message}`);
  }
}

/**
 * Create or find user in Better Auth database
 */
async function createOrFindUser(
  userInfo: UserInfo,
  provider: "google" | "apple",
  providerId: string
) {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  
  if (!db) {
    throw new Error("Database connection not available");
  }

  const usersCollection = db.collection("users");
  const accountsCollection = db.collection("accounts");

  // Check if account exists (by provider and providerId)
  const existingAccount = await accountsCollection.findOne({
    provider,
    providerAccountId: providerId,
  });

  let user: any;

  if (existingAccount) {
    // User exists, get user data. This is a raw driver query (bypasses
    // Mongoose schema casting entirely), so it must build its own dual-format
    // filter: `existingAccount.userId` can be a legacy hex ObjectId string
    // *or* a Better Auth UUID string (e.g. this account was originally
    // linked via web/OAuth sign-up and the user is now signing in on
    // mobile) — force-casting to `Types.ObjectId` would throw for the UUID
    // case.
    user = await usersCollection.findOne(toRawUserIdFilter(String(existingAccount.userId)) as any);
    
    if (!user) {
      throw new Error("Account found but user not found");
    }

    // Update last login
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } }
    );
  } else {
    // Normalize casing/whitespace so lookups match how the Stripe webhook
    // path already stores emails, avoiding case-mismatch account splits
    // (e.g. "User@x.com" vs "user@x.com" being treated as different users).
    const normalizedEmail = userInfo.email.trim().toLowerCase();

    // Check if user exists by email
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });

    if (existingUser) {
      // User exists but account doesn't - link account
      await accountsCollection.insertOne({
        userId: existingUser._id.toString(),
        provider,
        providerAccountId: providerId,
        type: "oauth",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      user = existingUser;
    } else {
      // Create new user
      const newUser = {
        _id: new mongoose.Types.ObjectId(),
        email: normalizedEmail,
        name: userInfo.name || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || userInfo.email,
        firstName: userInfo.firstName || userInfo.name?.split(' ')[0] || '',
        lastName: userInfo.lastName || userInfo.name?.split(' ').slice(1).join(' ') || '',
        emailVerified: true, // OAuth users are auto-verified
        isEmailVerified: true,
        image: userInfo.picture,
        avatar: userInfo.picture,
        role: "user",
        isActive: true,
        // Phase 10: new users default to Zero Pause Maintainer (public prices).
        zeroPauseProducts: ["maintainer"],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      await usersCollection.insertOne(newUser);

      // Create account
      await accountsCollection.insertOne({
        userId: newUser._id.toString(),
        provider,
        providerAccountId: providerId,
        type: "oauth",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      user = newUser;
    }
  }

  // Lazily backfill a purpose-built UUID identifier for use as StoreKit's
  // appAccountToken — `user._id` is unsafe to use directly since roughly
  // half the user base has a legacy non-UUID ObjectId `_id`.
  if (!user.iapAccountToken) {
    const newIapAccountToken = crypto.randomUUID();
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { iapAccountToken: newIapAccountToken } }
    );
    user.iapAccountToken = newIapAccountToken;
  }

  return user;
}

/**
 * Create session and return token
 */
async function createSession(userId: string): Promise<string> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  
  if (!db) {
    throw new Error("Database connection not available");
  }

  const sessionsCollection = db.collection("sessions");
  const auth = await getAuth();

  // Generate session token (Better Auth format)
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Create session
  await sessionsCollection.insertOne({
    userId: userId,
    sessionToken: sessionToken,
    expiresAt: expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Return token that can be used for API authentication
  // Better Auth uses sessionToken for authentication
  return sessionToken;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, provider, firstName, lastName } = body;

    if (!idToken || !provider) {
      return NextResponse.json(
        { error: "Missing idToken or provider" },
        { status: 400 }
      );
    }

    if (provider !== "google" && provider !== "apple") {
      return NextResponse.json(
        { error: "Unsupported provider. Use 'google' or 'apple'" },
        { status: 400 }
      );
    }

    logger.info(`Verifying ${provider} ID token`);

    // Verify ID token based on provider
    let userInfo: UserInfo;
    
    if (provider === "google") {
      if (parseGoogleClientIds().length === 0) {
        return NextResponse.json(
          { error: "Google OAuth not configured" },
          { status: 500 }
        );
      }
      userInfo = await verifyGoogleIdToken(idToken);
    } else {
      // Apple
      userInfo = await verifyAppleIdToken(idToken);
      
      // Apple provides name only on first sign-in, use provided values if available
      if (firstName) userInfo.firstName = firstName;
      if (lastName) userInfo.lastName = lastName;
    }

    logger.info(`ID token verified for user: ${userInfo.email}`);

    // Create or find user in database
    const user = await createOrFindUser(userInfo, provider, userInfo.sub);

    logger.info(`User found/created: ${user._id}`);

    // Create session
    const token = await createSession(user._id.toString());

    logger.info(`Session created for user: ${user._id}`);

    // Return user data and token
    return NextResponse.json({
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName || userInfo.firstName || '',
          lastName: user.lastName || userInfo.lastName || '',
          avatar: user.avatar || user.image || userInfo.picture,
          emailVerified: user.emailVerified || user.isEmailVerified || true,
          iapAccountToken: user.iapAccountToken,
        },
        token: token,
        session: {
          token: token,
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          userId: user._id.toString(),
        },
      },
    });
  } catch (error: any) {
    logger.error("ID token verification failed", {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: error.message || "Token verification failed" },
      { status: 401 }
    );
  }
}

