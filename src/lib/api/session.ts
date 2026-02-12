// Server-side session utilities for Next.js server components
import { cookies } from "next/headers";
import { getAuth } from "./better-auth";
import { fromNodeHeaders } from "better-auth/node";
import { headers } from "next/headers";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: "admin" | "learner" | "tutor";
  emailVerified?: boolean;
  isEmailVerified?: boolean;
  avatar?: string;
  image?: string;
  hasProfile?: boolean;
}

export interface ServerSession {
  user: SessionUser | null;
  session: any | null;
}

/**
 * Get session in server components
 * Uses Next.js cookies() to get session from Better Auth
 */
export async function getServerSession(): Promise<ServerSession> {
  try {
    const auth = await getAuth();
    if (!auth) {
      return { user: null, session: null };
    }

    // Get cookies from Next.js
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Convert cookies to headers format
    const headersObj: Record<string, string> = {};
    cookieStore.getAll().forEach((cookie) => {
      headersObj[cookie.name] = cookie.value;
    });

    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(headersObj),
    });

    if (!session || !session.user) {
      return { user: null, session: null };
    }

    // Default role if not set (don't update DB here - that's too expensive per request)
    // Role should be set during user creation or via a migration
    const userRole =
      (session.user.role as "admin" | "learner" | "tutor") || "learner";

    return {
      user: {
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.name,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: userRole,
        emailVerified: session.user.emailVerified,
        isEmailVerified:
          session.user.isEmailVerified || session.user.emailVerified,
        avatar: session.user.avatar || session.user.image,
        image: session.user.image || session.user.avatar,
        hasProfile: session.user.hasProfile || false,
      },
      session,
    };
  } catch (error) {
    console.error("Error getting server session:", error);
    return { user: null, session: null };
  }
}

/**
 * Get session from request headers (for use in middleware or API routes)
 */
export async function getSessionFromHeaders(
  headers: Headers
): Promise<ServerSession> {
  try {
    const auth = await getAuth();
    if (!auth) {
      return { user: null, session: null };
    }

    // Convert Headers to object
    const headersObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(headersObj),
    });

    if (!session || !session.user) {
      return { user: null, session: null };
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.name,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: (session.user.role as "admin" | "learner" | "tutor") || "learner",
        emailVerified: session.user.emailVerified,
        isEmailVerified:
          session.user.isEmailVerified || session.user.emailVerified,
        avatar: session.user.avatar || session.user.image,
        image: session.user.image || session.user.avatar,
        hasProfile: session.user.hasProfile || false,
      },
      session,
    };
  } catch (error) {
    console.error("Error getting session from headers:", error);
    return { user: null, session: null };
  }
}

/**
 * Require authentication in server components
 * Redirects to login if not authenticated
 */
export async function requireServerAuth(): Promise<SessionUser> {
  const { user } = await getServerSession();

  if (!user) {
    // In server components, we can't redirect directly
    // Return a special error that can be handled by the component
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

/**
 * Require specific role in server components
 */
export async function requireServerRole(
  allowedRoles: ("admin" | "learner" | "tutor")[]
): Promise<SessionUser> {
  const user = await requireServerAuth();

  if (!allowedRoles.includes(user.role || "learner")) {
    throw new Error("FORBIDDEN");
  }

  return user;
}
