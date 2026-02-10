// app/api/v1/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/api/better-auth";
import { logger } from "@/lib/api/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10; // Increase timeout to 10 seconds (Vercel Pro+)

// Log that the route file is loaded
logger.info("Better Auth route handler loaded");

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
      logger.error("Better Auth instance is null");
      throw new Error("Better Auth instance is null");
    }

    // Create and cache handlers
    cachedHandlers = toNextJsHandler(auth);
    logger.info("Better Auth handlers initialized successfully");

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
    const url = new URL(req.url);
    logger.info("Auth GET request received", { 
      pathname: url.pathname, 
      search: url.search,
      fullUrl: req.url
    });
    
    const handlers = await getHandlers();
    if (!handlers || !handlers.GET) {
      logger.error("Handlers not available", { handlers: !!handlers });
      return Response.json(
        { error: "Authentication handlers not initialized" },
        { status: 503 }
      );
    }
    
    logger.info("Calling Better Auth GET handler");
    const response = await handlers.GET(req);
    logger.info("Better Auth GET handler responded", { 
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    });
    return response;
  } catch (error: any) {
    logger.error("GET request failed", { 
      error: error.message, 
      stack: error.stack,
      url: req.url
    });
    return Response.json(
      { error: "Authentication service temporarily unavailable", details: error.message },
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
