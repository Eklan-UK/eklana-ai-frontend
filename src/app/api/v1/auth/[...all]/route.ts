// app/api/v1/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/api/better-auth";
import { logger } from "@/lib/api/logger";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";

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
    
    // Log OAuth-related requests to debug redirect URI
    if (url.pathname.includes('/auth/sign-in/social') || url.pathname.includes('/callback')) {
      logger.info("OAuth request detected", {
        pathname: url.pathname,
        searchParams: Object.fromEntries(url.searchParams.entries()),
        fullUrl: req.url,
        headers: {
          origin: req.headers.get('origin'),
          referer: req.headers.get('referer'),
          host: req.headers.get('host'),
        }
      });
    } else {
      logger.info("Auth GET request received", { 
        pathname: url.pathname, 
        search: url.search,
        fullUrl: req.url
      });
    }
    
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
    
    // After OAuth callback, ensure hasProfile is set correctly for new users
    // This runs asynchronously after response is sent to not block the OAuth flow
    if (url.pathname.includes('/callback') && (response.status === 200 || response.status === 302)) {
      // Use Promise to handle async without blocking response
      ensureOAuthUserHasProfile(req).catch((error: any) => {
        // Non-critical error, log but don't fail OAuth flow
        logger.warn("Error ensuring OAuth user hasProfile in GET", {
          error: error.message,
        });
      });
    }
    
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

/**
 * Ensure OAuth user has hasProfile set correctly
 * This is called after OAuth callback to ensure new users have hasProfile: false
 * For admin/tutor roles, hasProfile should be true
 */
async function ensureOAuthUserHasProfile(req: Request) {
  try {
    const auth = await getAuth();
    if (!auth) {
      logger.warn("Auth instance not available for hasProfile check");
      return;
    }

    // Get session from request headers (includes cookies set by Better Auth)
    const session = await auth.api.getSession({
      headers: Object.fromEntries(req.headers.entries()),
    });

    if (!session?.user?.id) {
      logger.debug("No session found for hasProfile check");
      return;
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    
    if (!user) {
      logger.warn("User not found for hasProfile check", {
        userId: session.user.id,
      });
      return;
    }

    // Determine what hasProfile should be based on role
    const shouldHaveProfile = user.role === 'admin' || user.role === 'tutor';
    const needsUpdate = shouldHaveProfile 
      ? user.hasProfile !== true
      : (user.hasProfile === undefined || user.hasProfile !== false);

    if (needsUpdate) {
      user.hasProfile = shouldHaveProfile;
      await user.save();
      logger.info("Updated OAuth user hasProfile", {
        userId: user._id.toString(),
        email: user.email,
        hasProfile: user.hasProfile,
        role: user.role,
        isNewUser: user.createdAt && (Date.now() - new Date(user.createdAt).getTime()) < 60000, // Created in last minute
      });
    } else {
      logger.debug("OAuth user hasProfile already correct", {
        userId: user._id.toString(),
        hasProfile: user.hasProfile,
        role: user.role,
      });
    }
  } catch (error: any) {
    // Log error but don't throw - this is non-critical for OAuth flow
    logger.error("Error ensuring OAuth user hasProfile", {
      error: error.message,
      stack: error.stack,
    });
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const handlers = await getHandlers();
    const response = await handlers.POST(req);
    
    // After OAuth signup/login, ensure hasProfile is set correctly
    // This runs asynchronously after response is sent to not block the OAuth flow
    if ((url.pathname.includes('/callback') || url.pathname.includes('/sign-in/social')) && 
        (response.status === 200 || response.status === 302)) {
      // Use Promise to handle async without blocking response
      ensureOAuthUserHasProfile(req).catch((error: any) => {
        // Non-critical error, log but don't fail OAuth flow
        logger.warn("Error ensuring OAuth user hasProfile in POST", {
          error: error.message,
        });
      });
    }
    
    return response;
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
