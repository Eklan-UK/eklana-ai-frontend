// GET /api/v1/admin/pressure-test/export
//
// Streams a newline-delimited JSON (JSONL) file of pressure-test raw data
// for use in fine-tuning an "Eklan-flavored" AI model.
//
// Each line is a training example shaped as:
//   { "prompt": "<system_instruction>\n\nAI: <aiPrompt>",
//     "response": "<studentTranscript>",
//     "metadata": { userId, level, latencyMs, accuracyScore, confidenceScore,
//                   pronunciationScore, date } }
//
// Query params:
//   ?from=<ISO date>        — only export sessions after this date
//   ?to=<ISO date>          — only export sessions before this date
//   ?level=<1-20>           — filter by a specific pressure-test level
//   ?minAccuracy=<0-100>    — only include turns with accuracy >= this value
//   ?limit=<n>              — max sessions to include (default 5000)
//
// Access: admin only.
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import PressureTestRawData from "@/models/pressure-test-raw-data";
import PressureTestSession from "@/models/pressure-test-session";
import { logger } from "@/lib/api/logger";
import { Types } from "mongoose";

const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 20000;

async function handler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  void context.userId;
  void context.userRole;

  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const levelFilter = searchParams.get("level");
    const minAccuracy = parseInt(searchParams.get("minAccuracy") ?? "0", 10) || 0;
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    // Build query filter
    const sessionFilter: Record<string, unknown> = {};
    if (from || to) {
      const dateRange: Record<string, Date> = {};
      if (from) dateRange.$gte = new Date(from);
      if (to) dateRange.$lte = new Date(to);
      sessionFilter.createdAt = dateRange;
    }
    if (levelFilter) {
      const lvl = parseInt(levelFilter, 10);
      if (!isNaN(lvl)) sessionFilter.level = lvl;
    }

    // Fetch raw data documents, join with session for overallAccuracy filter
    const rawDocs = await PressureTestRawData.find(sessionFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // When minAccuracy is set we need the session's overallAccuracy for filtering
    let sessionAccuracyMap = new Map<string, number>();
    if (minAccuracy > 0) {
      const sessionIds = rawDocs.map((d: any) => d.sessionId);
      const sessions = await PressureTestSession.find({ _id: { $in: sessionIds } })
        .select("overallAccuracy")
        .lean();
      sessions.forEach((s: any) => {
        sessionAccuracyMap.set(s._id.toString(), s.overallAccuracy ?? 0);
      });
    }

    // Build JSONL lines
    const lines: string[] = [];

    for (const doc of rawDocs as any[]) {
      const sessionId = doc.sessionId?.toString() ?? "";

      // Apply accuracy filter at session level
      if (minAccuracy > 0) {
        const acc = sessionAccuracyMap.get(sessionId) ?? 0;
        if (acc < minAccuracy) continue;
      }

      for (const turn of doc.turns ?? []) {
        // Skip turns with very short or empty transcripts (noise)
        const transcript = (turn.studentTranscript ?? "").trim();
        if (transcript.length < 3) continue;

        const systemHint = doc.systemPromptSnapshot
          ? `${doc.systemPromptSnapshot}\n\n`
          : `You are an Eklan Pressure Test instructor at level ${doc.level}.\n\n`;

        const record = {
          prompt: `${systemHint}AI: ${turn.aiPrompt}`,
          response: transcript,
          metadata: {
            userId: doc.userId?.toString() ?? "",
            sessionId,
            level: doc.level,
            turnNumber: turn.turnNumber,
            latencyMs: turn.latencyMs,
            accuracyScore: turn.accuracyScore ?? 0,
            confidenceScore: turn.confidenceScore ?? 0,
            pronunciationScore: turn.pronunciationOverallScore ?? 0,
            geminiModel: doc.geminiModelUsed ?? "",
            date: doc.createdAt,
          },
        };

        lines.push(JSON.stringify(record));
      }
    }

    const filename = `pressure_test_export_${new Date().toISOString().slice(0, 10)}.jsonl`;

    logger.info("Pressure test JSONL export requested", {
      adminId: context.userId?.toString(),
      sessions: rawDocs.length,
      lines: lines.length,
    });

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Total-Sessions": String(rawDocs.length),
        "X-Total-Lines": String(lines.length),
      },
    });
  } catch (error: any) {
    logger.error("Error generating pressure-test export", {
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { code: "ServerError", message: "Failed to generate export." },
      { status: 500 },
    );
  }
}

export const GET = withRole(["admin"], handler);
export const maxDuration = 300;
