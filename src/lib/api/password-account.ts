import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { verifyPassword } from "better-auth/crypto";
import { connectToDatabase } from "@/lib/api/db";
import { getAuth } from "@/lib/api/better-auth";
import User from "@/models/user";

function isBcryptHash(storedHash: string): boolean {
  return storedHash.startsWith("$2");
}

async function resolveAuthUserId(mongoUserId: Types.ObjectId): Promise<string> {
  await connectToDatabase();
  const auth = await getAuth();
  const ctx = await auth.$context;

  const byMongoId = await ctx.internalAdapter.findUserById(mongoUserId.toString());
  if (byMongoId?.id) return byMongoId.id;

  const mongoose = await import("mongoose");
  const db = mongoose.connection.db;
  const userDoc = await db?.collection("users").findOne({ _id: mongoUserId });
  if (userDoc && typeof userDoc.id === "string" && userDoc.id.length > 0) {
    return userDoc.id;
  }

  return mongoUserId.toString();
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
  userId: Types.ObjectId,
): Promise<string | null> {
  await connectToDatabase();
  const auth = await getAuth();
  const ctx = await auth.$context;
  const authUserId = await resolveAuthUserId(userId);

  const accounts = await ctx.internalAdapter.findAccounts(authUserId);
  const credential = accounts.find((account) => account.providerId === "credential");
  const password = credential?.password;
  return typeof password === "string" && password.length > 0 ? password : null;
}

export async function userHasPassword(
  userId: Types.ObjectId,
  userPassword?: string | null,
): Promise<boolean> {
  if (userPassword) return true;
  const credentialPassword = await getCredentialPasswordHash(userId);
  return !!credentialPassword;
}

/** Set password via Better Auth so email sign-in uses the same credential store. */
export async function applyPasswordUpdate(
  userId: Types.ObjectId,
  plainPassword: string,
): Promise<void> {
  await connectToDatabase();
  const auth = await getAuth();
  const ctx = await auth.$context;
  const authUserId = await resolveAuthUserId(userId);
  const hashedPassword = await ctx.password.hash(plainPassword);

  const accounts = await ctx.internalAdapter.findAccounts(authUserId);
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
