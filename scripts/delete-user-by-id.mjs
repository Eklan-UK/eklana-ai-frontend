/**
 * One-off: delete a user from MongoDB by _id (and related Better Auth sessions).
 *
 * Usage:
 *   node scripts/delete-user-by-id.mjs <ObjectId> <email-confirm>
 *
 * Example:
 *   node scripts/delete-user-by-id.mjs 69621a24bbc2b791bc53783d mayorsuleimankhan1@gmail.com
 */
import mongoose from "mongoose";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const userId = process.argv[2];
const emailConfirm = (process.argv[3] || "").trim().toLowerCase();

if (!userId || !emailConfirm) {
  console.error(
    "Usage: node scripts/delete-user-by-id.mjs <ObjectId> <email-confirm>"
  );
  process.exit(1);
}

if (!mongoose.Types.ObjectId.isValid(userId)) {
  console.error("Invalid ObjectId");
  process.exit(1);
}

const uri = (process.env.MONGO_URI || "").trim();
if (!uri) {
  console.error("MONGO_URI is not set (add it to .env or export it for this command).");
  process.exit(1);
}

if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
  console.error(`
Invalid MONGO_URI: must start with mongodb:// or mongodb+srv://

You are not connecting to the staging *website* (https://…). You need the
MongoDB Atlas (or host) connection string — same value as in Vercel/env for
that environment.

  Atlas: Cluster → Connect → Drivers → copy the URI
  Then:  node scripts/delete-user-by-id.mjs <ObjectId> <email>

Or prefix once (use your real URI, not a public URL):
  MONGO_URI='mongodb+srv://…' node scripts/delete-user-by-id.mjs …
`);
  process.exit(1);
}

const oid = new mongoose.Types.ObjectId(userId);

await mongoose.connect(uri);
const db = mongoose.connection.db;

const user = await db.collection("users").findOne({ _id: oid });
if (!user) {
  console.log("No user with that _id.");
  await mongoose.disconnect();
  process.exit(0);
}

const dbEmail = String(user.email || "").toLowerCase();
if (dbEmail !== emailConfirm) {
  console.error(
    `Email mismatch (expected ${emailConfirm}, DB has ${user.email}). Abort.`
  );
  await mongoose.disconnect();
  process.exit(1);
}

const sessions = await db.collection("sessions").deleteMany({
  $or: [{ userId: oid }, { userId: userId }, { userId: oid.toString() }],
});

const del = await db.collection("users").deleteOne({ _id: oid });

console.log(JSON.stringify({ sessionsDeleted: sessions.deletedCount, userDeleted: del.deletedCount }, null, 2));

await mongoose.disconnect();
