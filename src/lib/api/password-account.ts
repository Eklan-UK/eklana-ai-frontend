import bcrypt from "bcryptjs";
import { verifyPassword } from "better-auth/crypto";
import { connectToDatabase } from "@/lib/api/db";
import { getAuth } from "@/lib/api/better-auth";
import { toRawUserIdFilter } from "@/lib/api/user-id";
import User from "@/models/user";

/** Shape used from Better Auth internalAdapter.findAccounts (credential row). */
type AuthCredentialAccount = {
  providerId: string;
  password?: string | null;
};

function isBcryptHash(storedHash: string): boolean {
  return storedHash.startsWith("$2");
}

// userId is a plain string: a UUID for Better Auth web/OAuth sign-ups, or a
// 24-char hex ObjectId string for legacy/mobile accounts (see
// src/lib/api/user-id.ts). Kept as `string` throughout rather than
// `Types.ObjectId` since callers (auth middleware's `context.userId`) never
// hand back a cast ObjectId instance anymore.
async function resolveAuthUserId(userId: string): Promise<string> {
  await connectToDatabase();
  const auth = await getAuth();
  const ctx = await auth.$context;

  const byMongoId = await ctx.internalAdapter.findUserById(userId);
  if (byMongoId?.id) return byMongoId.id;

  const mongoose = await import("mongoose");
  const db = mongoose.connection.db;
  // Raw driver query against the `users` collection bypasses Mongoose's
  // schema-based casting entirely, so a legacy hex-string id would never
  // match a document whose `_id` is stored as a real BSON ObjectId unless
  // we explicitly build the filter with `toRawUserIdFilter` (same pattern
  // as the bearer-token path in src/lib/api/middleware.ts).
  const userDoc = await db?.collection("users").findOne(toRawUserIdFilter(userId) as any);
  if (userDoc && typeof userDoc.id === "string" && userDoc.id.length > 0) {
    return userDoc.id;
  }

  return userId;
}

export async function verifyStoredPassword(
  plainPassword: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) return false;

  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(plainPassword, storedHash);
  }

  return verifyPassword({ hash: storedHash, password: plainPassword });
}

export async function getCredentialPasswordHash(
  userId: string,
): Promise<string | null> {
  await connectToDatabase();
  const auth = await getAuth();
  const ctx = await auth.$context;
  const authUserId = await resolveAuthUserId(userId);

  const accounts = (await ctx.internalAdapter.findAccounts(
    authUserId,
  )) as AuthCredentialAccount[];
  const credential = accounts.find((account) => account.providerId === "credential");
  const password = credential?.password;
  return typeof password === "string" && password.length > 0 ? password : null;
}

export async function userHasPassword(
  userId: string,
  userPassword?: string | null,
): Promise<boolean> {
  if (userPassword) return true;
  const credentialPassword = await getCredentialPasswordHash(userId);
  return !!credentialPassword;
}

/** Set password via Better Auth so email sign-in uses the same credential store. */
export async function applyPasswordUpdate(
  userId: string,
  plainPassword: string,
): Promise<void> {
  await connectToDatabase();
  const auth = await getAuth();
  const ctx = await auth.$context;
  const authUserId = await resolveAuthUserId(userId);
  const hashedPassword = await ctx.password.hash(plainPassword);

  const accounts = (await ctx.internalAdapter.findAccounts(
    authUserId,
  )) as AuthCredentialAccount[];
  const hasCredential = accounts.some(
    (account) => account.providerId === "credential",
  );

  if (!hasCredential) {
    await ctx.internalAdapter.linkAccount({
      userId: authUserId,
      providerId: "credential",
      accountId: authUserId,
      password: hashedPassword,
    });
  } else {
    await ctx.internalAdapter.updatePassword(authUserId, hashedPassword);
  }

  // Remove legacy credential rows created with the wrong userId key.
  const mongoIdStr = userId.toString();
  if (mongoIdStr !== authUserId) {
    const mongoose = await import("mongoose");
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("accounts").deleteMany({
        providerId: "credential",
        userId: mongoIdStr,
      });
    }
  }

  await User.findByIdAndUpdate(userId, {
    $set: { password: hashedPassword },
  }).exec();
}
