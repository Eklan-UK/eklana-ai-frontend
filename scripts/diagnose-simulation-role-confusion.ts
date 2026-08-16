/**
 * Diagnose potential role confusion in Simulation Room AI turns.
 * Prints every AI-role turn from the 5 most recent sessions that are either
 * completed or have more than 2 turns, so they can be manually scanned for
 * the AI narrating the student's actions or addressing the student as
 * another character.
 *
 * Usage:
 *   npx tsx scripts/diagnose-simulation-role-confusion.ts
 *
 * Loads .env.local then .env for MONGO_URI before importing anything that
 * reads process.env at module-load time (config.ts / db.ts), so those
 * imports must be dynamic, done after loadEnv runs.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const mongoose = (await import("mongoose")).default;
  const { connectToDatabase } = await import("../src/lib/api/db");
  const { default: SimulationSession } = await import("../src/models/simulation-session");
  const { default: SimulationScenario } = await import("../src/models/simulation-scenario");

  await connectToDatabase();

  const sessions = await SimulationSession.find({
    $or: [{ status: "completed" }, { "turns.2": { $exists: true } }],
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
    .exec();

  console.log(`Found ${sessions.length} matching session(s)\n`);

  for (const session of sessions) {
    const sessionId = String(session._id);
    const scenario = await SimulationScenario.findById(session.scenarioId)
      .select("studentCharacterName")
      .lean()
      .exec();

    const studentCharacterName = scenario?.studentCharacterName ?? "(scenario missing)";

    console.log(
      `=== Session ${sessionId} | status=${session.status} | turns=${session.turns.length} | studentCharacterName="${studentCharacterName}" ===`
    );

    const aiTurns = session.turns.filter((t) => t.role === "ai");
    if (aiTurns.length === 0) {
      console.log("  (no AI turns)");
    }

    for (const turn of aiTurns) {
      console.log(`[${sessionId}] turn ${turn.turnNumber}: ${turn.text}`);
    }

    console.log("");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
