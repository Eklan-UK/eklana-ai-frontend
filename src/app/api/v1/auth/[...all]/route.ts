// Better Auth route handler for Next.js App Router
// This catches all /api/v1/auth/* routes
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth, initializeBetterAuth } from "@/lib/api/better-auth";
import { connectToDatabase } from "@/lib/api/db";
import { logger } from "@/lib/api/logger";

// Configure runtime for Vercel - required for Mongoose and Better Auth
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ensure Better Auth is initialized before handling requests
let authHandlers: any = null;
let isInitializing = false;
let initPromise: Promise<any> | null = null;

async function getAuthHandlers() {
  if (authHandlers) {
    return authHandlers;
  }

  // If already initializing, wait for it
  if (initPromise) {
    await initPromise;
    return authHandlers;
  }

  // Start initialization
  if (!isInitializing) {
    isInitializing = true;
    initPromise = (async () => {
      try {
        // Connect to database first
        logger.info("Connecting to database for Better Auth...");
        await connectToDatabase();
        logger.info("Database connected, initializing Better Auth...");
        
        // Initialize Better Auth
        await initializeBetterAuth();
        const auth = await getAuth();
        
        if (auth) {
          authHandlers = toNextJsHandler(auth);
          logger.info("Better Auth handlers created successfully");
        } else {
          logger.error("Better Auth initialization returned null");
        }
      } catch (error: any) {
        logger.error("Failed to initialize Better Auth handlers", {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      } finally {
        isInitializing = false;
      }
    })();
  }

  await initPromise;
  return authHandlers;
}

export async function GET(req: Request) {
  const handlers = await getAuthHandlers();
  return handlers?.GET
    ? handlers.GET(req)
    : Response.json({ error: "Auth not initialized" }, { status: 503 });
}

export async function POST(req: Request) {
  const handlers = await getAuthHandlers();
  return handlers?.POST
    ? handlers.POST(req)
    : Response.json({ error: "Auth not initialized" }, { status: 503 });
}

export async function PUT(req: Request) {
  const handlers = await getAuthHandlers();
  return handlers?.PUT
    ? handlers.PUT(req)
    : Response.json({ error: "Auth not initialized" }, { status: 503 });
}

export async function DELETE(req: Request) {
  const handlers = await getAuthHandlers();
  return handlers?.DELETE
    ? handlers.DELETE(req)
    : Response.json({ error: "Auth not initialized" }, { status: 503 });
}

export async function PATCH(req: Request) {
  const handlers = await getAuthHandlers();
  return handlers?.PATCH
    ? handlers.PATCH(req)
    : Response.json({ error: "Auth not initialized" }, { status: 503 });
}
