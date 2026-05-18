/**
 * One-off: delete a user from MongoDB by _id (and related Better Auth + profile rows).
 *
 * Usage:
 *   node scripts/delete-user-by-id.mjs <userId> <email-confirm>
 *
 * `<userId>` may be a 24-hex MongoDB ObjectId or a string _id (e.g. Better Auth UUID).
 *
 * Example:
 *   node scripts/delete-user-by-id.mjs 69621a24bbc2b791bc53783d mayorsuleimankhan1@gmail.com
 *
 * Optional: `MONGO_DB=elkan-db` if your `MONGO_URI` default database name differs from where users live.
 */
import mongoose from "mongoose";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const userIdArg = (process.argv[2] || "").trim();
const emailConfirm = (process.argv[3] || "").trim().toLowerCase();

if (!userIdArg || !emailConfirm) {
  console.error(
    "Usage: node scripts/delete-user-by-id.mjs <userId> <email-confirm>"
  );
  process.exit(1);
}

const uri = (process.env.MONGO_URI || "").trim();
if (!uri) {
  console.error(
    "MONGO_URI is not set (add it to .env or export it for this command)."
  );
  process.exit(1);
}

if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
  console.error(`
Invalid MONGO_URI: must start with mongodb:// or mongodb+srv://

You are not connecting to the staging *website* (https://…). You need the
MongoDB Atlas (or host) connection string — same value as in Vercel/env for
that environment.

  Atlas: Cluster → Connect → Drivers → copy the URI
  Then:  node scripts/delete-user-by-id.mjs <userId> <email>

Or prefix once (use your real URI, not a public URL):
  MONGO_URI='mongodb+srv://…' node scripts/delete-user-by-id.mjs …
`);
  process.exit(1);
}

function idMatchClauses(raw) {
  const clauses = [{ _id: raw }];
  if (mongoose.Types.ObjectId.isValid(raw) && String(raw).length === 24) {
    clauses.push({ _id: new mongoose.Types.ObjectId(raw) });
  }
  return clauses;
}

await mongoose.connect(uri);
/** Same cluster, different DB name (e.g. URI ends with /eklan-ai but data lives in elkan-db). */
const mongoDbOverride = (process.env.MONGO_DB || "").trim();
const db = mongoDbOverride
  ? mongoose.connection.useDb(mongoDbOverride, { useCache: true })
  : mongoose.connection.db;

const user = await db.collection("users").findOne({
  $or: idMatchClauses(userIdArg),
});

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

const actualId = user._id;
const idStr = String(actualId);

const sessionOr = [
  { userId: actualId },
  { userId: idStr },
  { userId: userIdArg },
];
if (mongoose.Types.ObjectId.isValid(userIdArg) && userIdArg.length === 24) {
  sessionOr.push({ userId: new mongoose.Types.ObjectId(userIdArg) });
}

const sessions = await db.collection("sessions").deleteMany({ $or: sessionOr });

let accountsDeleted = 0;
try {
  const ar = await db.collection("accounts").deleteMany({ $or: sessionOr });
  accountsDeleted = ar.deletedCount;
} catch {
  // collection may not exist in older DBs
}

let profilesDeleted = 0;
try {
  const profileOr = [
    { userId: actualId },
    { userId: idStr },
    { userId: userIdArg },
  ];
  if (mongoose.Types.ObjectId.isValid(userIdArg) && userIdArg.length === 24) {
    profileOr.push({ userId: new mongoose.Types.ObjectId(userIdArg) });
  }
  const pr = await db.collection("profiles").deleteMany({ $or: profileOr });
  profilesDeleted = pr.deletedCount;
} catch {
  // optional
}

const del = await db.collection("users").deleteOne({ _id: actualId });

console.log(
  JSON.stringify(
    {
      sessionsDeleted: sessions.deletedCount,
      accountsDeleted,
      profilesDeleted,
      userDeleted: del.deletedCount,
    },
    null,
    2
  )
);

await mongoose.disconnect();
