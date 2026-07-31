/**
 * Diagnose MongoDB connection usage / limit exhaustion.
 *
 * Usage:
 *   npx tsx scripts/check-mongo-connections.ts
 *
 * Loads .env.local then .env for MONGO_URI. Connects with a tiny pool so the
 * check itself does not worsen exhaustion.
 */
import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const LIMIT_PATTERNS = [
  /too many connections/i,
  /connection.*limit/i,
  /exceeded.*connection/i,
  /maximum number of connections/i,
];

type Verdict = "AT_OR_NEAR_LIMIT" | "OK" | "UNKNOWN";

function looksLikeLimitError(message: string): boolean {
  return LIMIT_PATTERNS.some((re) => re.test(message));
}

function redactUri(uri: string): string {
  try {
    return uri.replace(/\/\/([^@/]+)@/, "//***:***@");
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("MONGO_URI is not set. Add it to .env.local or .env.");
    process.exit(1);
  }

  console.log("=== MongoDB connection check ===");
  console.log(`URI: ${redactUri(uri)}`);
  console.log("Pool: maxPoolSize=1, minPoolSize=0\n");

  let verdict: Verdict = "UNKNOWN";

  try {
    await mongoose.connect(uri, {
      dbName: "elkan-db",
      appName: "Elkan mongo connection check",
      maxPoolSize: 1,
      minPoolSize: 0,
      maxIdleTimeMS: 5000,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 15000,
      family: 4,
    });

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Connected but mongoose.connection.db is undefined");
    }

    const ping = await db.admin().command({ ping: 1 });
    console.log("Ping:", ping.ok === 1 ? "ok" : ping);

    try {
      const status = await db.admin().command({ serverStatus: 1 });
      const connections = status.connections ?? {};
      const current = Number(connections.current ?? 0);
      const available = Number(connections.available ?? 0);
      const active = Number(connections.active ?? 0);
      const total = current + available;
      const usagePct = total > 0 ? Math.round((current / total) * 100) : null;

      console.log("\n=== serverStatus.connections ===");
      console.log(
        JSON.stringify(
          {
            current,
            available,
            active,
            totalCreated: connections.totalCreated ?? null,
            usagePct,
          },
          null,
          2
        )
      );

      if (available <= 5 || (usagePct !== null && usagePct >= 90)) {
        verdict = "AT_OR_NEAR_LIMIT";
      } else {
        verdict = "OK";
      }
    } catch (statusErr: unknown) {
      const msg =
        statusErr instanceof Error ? statusErr.message : String(statusErr);
      console.log("\n=== serverStatus unavailable ===");
      console.log(msg);
      console.log(
        "Connected successfully, but this user cannot run serverStatus."
      );
      console.log(
        "Check Atlas UI → Cluster → Metrics → Connections for exact counts."
      );
      verdict = "UNKNOWN";
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Error";
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : undefined;

    console.error("\n=== Connect failed ===");
    console.error(`name: ${name}`);
    if (code) console.error(`code: ${code}`);
    console.error(`message: ${message}`);

    if (looksLikeLimitError(message)) {
      verdict = "AT_OR_NEAR_LIMIT";
      console.error("\nThis looks like a MongoDB connection-limit error.");
    } else {
      verdict = "UNKNOWN";
      console.error(
        "\nConnect failed, but the message does not clearly indicate a connection limit."
      );
    }
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch {
      // ignore disconnect errors
    }
  }

  console.log(`\nVERDICT: ${verdict}`);
  process.exit(verdict === "AT_OR_NEAR_LIMIT" ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
