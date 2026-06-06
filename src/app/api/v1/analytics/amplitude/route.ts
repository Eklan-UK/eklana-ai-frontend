/**
 * First-party proxy for Amplitude event ingestion.
 * Avoids browser/ad-blocker blocks on api2.amplitude.com by forwarding same-origin.
 *
 * POST /api/v1/analytics/amplitude
 */

import { NextRequest, NextResponse } from "next/server";

const US_INGEST_URL = "https://api2.amplitude.com/2/httpapi";
const EU_INGEST_URL = "https://api.eu.amplitude.com/2/httpapi";

function getIngestUrl(): string {
  return process.env.AMPLITUDE_SERVER_ZONE === "EU"
    ? EU_INGEST_URL
    : US_INGEST_URL;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.text();

    if (!body) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 },
      );
    }

    const response = await fetch(getIngestUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    const responseText = await response.text();

    return new NextResponse(responseText || null, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[Amplitude proxy] Forward failed:", error);
    }

    // Return 200 so the SDK does not retry aggressively in dev.
    return NextResponse.json(
      {
        code: 503,
        error: "Amplitude ingest unavailable",
      },
      { status: 200 },
    );
  }
}
