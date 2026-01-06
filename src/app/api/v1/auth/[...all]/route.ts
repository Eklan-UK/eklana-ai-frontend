// app/api/v1/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/api/better-auth";
import { logger } from "@/lib/api/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10; // Increase timeout to 10 seconds (Vercel Pro+)

// Cache handlers globally across serverless invocations
let cachedHandlers: any = null;

async function getHandlers() {
  // Return cached handlers if available
  if (cachedHandlers) {
    return cachedHandlers;
  }

  try {
    // getAuth() now handles connection + initialization internally with caching
    const auth = await getAuth();

    if (!auth) {
      throw new Error("Better Auth instance is null");
    }

    // Create and cache handlers
    cachedHandlers = toNextJsHandler(auth);
    logger.info("Better Auth handlers initialized");

    return cachedHandlers;
  } catch (error: any) {
    logger.error("Failed to get auth handlers", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function GET(req: Request) {
  try {
    const handlers = await getHandlers();
    return handlers.GET(req);
  } catch (error: any) {
    logger.error("GET request failed", { error: error.message });
    return Response.json(
      { error: "Authentication service temporarily unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const handlers = await getHandlers();
    return handlers.POST(req);
  } catch (error: any) {
    logger.error("POST request failed", { error: error.message });
    return Response.json(
      { error: "Authentication service temporarily unavailable" },
      { status: 503 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const handlers = await getHandlers();
    return handlers.PUT(req);
  } catch (error: any) {
    logger.error("PUT request failed", { error: error.message });
    return Response.json(
      { error: "Authentication service temporarily unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const handlers = await getHandlers();
    return handlers.DELETE(req);
  } catch (error: any) {
    logger.error("DELETE request failed", { error: error.message });
    return Response.json(
      { error: "Authentication service temporarily unavailable" },
      { status: 503 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const handlers = await getHandlers();
    return handlers.PATCH(req);
  } catch (error: any) {
    logger.error("PATCH request failed", { error: error.message });
    return Response.json(
      { error: "Authentication service temporarily unavailable" },
      { status: 503 }
    );
  }
}
