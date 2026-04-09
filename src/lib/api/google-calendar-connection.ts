import { Types } from "mongoose";
import { connectToDatabase } from "./db";

const COLLECTION = "google_calendar_connections";

type GoogleConnectionReason =
  | "missing_account"
  | "missing_refresh_token";

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  reason?: GoogleConnectionReason;
}

type CalendarConnectionDoc = Record<string, unknown> & {
  userId?: unknown;
};

const REFRESH_TOKEN_CANDIDATE_KEYS = [
  "refreshToken",
  "refresh_token",
  "refresh-token",
];

const tokenAtPath = (obj: Record<string, unknown>, path: string): string => {
  const value = path.split(".").reduce<unknown>((curr, part) => {
    if (!curr || typeof curr !== "object") return undefined;
    return (curr as Record<string, unknown>)[part];
  }, obj);
  return typeof value === "string" ? value.trim() : "";
};

const extractRefreshToken = (doc: CalendarConnectionDoc): string => {
  for (const key of REFRESH_TOKEN_CANDIDATE_KEYS) {
    const value = tokenAtPath(doc, key);
    if (value) return value;
  }
  for (const key of ["tokens.refresh_token", "token.refresh_token"]) {
    const value = tokenAtPath(doc, key);
    if (value) return value;
  }
  return "";
};

const userIdCandidates = (userId: string) => {
  const candidates: unknown[] = [userId];
  if (Types.ObjectId.isValid(userId)) {
    candidates.push(new Types.ObjectId(userId));
  }
  return candidates;
};

export async function upsertGoogleCalendarRefreshToken(
  userId: string,
  refreshToken: string,
): Promise<void> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB database instance not available");
  }
  const uid = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  await db.collection(COLLECTION).updateOne(
    { userId: uid },
    {
      $set: {
        userId: uid,
        refreshToken: refreshToken.trim(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function getGoogleCalendarRefreshTokenForUser(
  userId: string,
): Promise<string | null> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    return null;
  }

  const doc = (await db.collection(COLLECTION).findOne({
    userId: { $in: userIdCandidates(userId) },
  })) as CalendarConnectionDoc | null;

  if (!doc) {
    return null;
  }

  const refreshToken = extractRefreshToken(doc);
  return refreshToken || null;
}

export async function deleteGoogleCalendarConnectionForUser(
  userId: string,
): Promise<{ deleted: boolean }> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB database instance not available");
  }

  const result = await db.collection(COLLECTION).deleteMany({
    userId: { $in: userIdCandidates(userId) },
  });

  return { deleted: result.deletedCount > 0 };
}

export async function getGoogleCalendarConnectionStatusForUser(
  userId: string,
): Promise<GoogleCalendarConnectionStatus> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    return { connected: false, reason: "missing_account" };
  }

  const doc = (await db.collection(COLLECTION).findOne({
    userId: { $in: userIdCandidates(userId) },
  })) as CalendarConnectionDoc | null;

  if (!doc) {
    return { connected: false, reason: "missing_account" };
  }

  return extractRefreshToken(doc)
    ? { connected: true }
    : { connected: false, reason: "missing_refresh_token" };
}

export async function getGoogleCalendarConnectionMapForUsers(
  userIds: string[],
): Promise<Map<string, GoogleCalendarConnectionStatus>> {
  const result = new Map<string, GoogleCalendarConnectionStatus>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return result;

  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    for (const id of ids) {
      result.set(id, { connected: false, reason: "missing_account" });
    }
    return result;
  }

  const allCandidates = ids.flatMap((id) => userIdCandidates(id));
  const docs = (await db
    .collection(COLLECTION)
    .find({
      userId: { $in: allCandidates },
    })
    .toArray()) as CalendarConnectionDoc[];

  const byUserKey = new Map<string, CalendarConnectionDoc>();
  for (const doc of docs) {
    const rawUserId = doc.userId;
    if (rawUserId == null) continue;
    byUserKey.set(String(rawUserId), doc);
  }

  for (const id of ids) {
    const objectIdKey = Types.ObjectId.isValid(id)
      ? String(new Types.ObjectId(id))
      : "";
    const doc =
      byUserKey.get(id) ||
      (objectIdKey ? byUserKey.get(objectIdKey) : undefined);
    if (!doc) {
      result.set(id, { connected: false, reason: "missing_account" });
      continue;
    }
    result.set(
      id,
      extractRefreshToken(doc)
        ? { connected: true }
        : { connected: false, reason: "missing_refresh_token" },
    );
  }

  return result;
}
