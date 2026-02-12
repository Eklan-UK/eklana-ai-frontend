// Debug endpoint to show the exact OAuth redirect URI being used
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Use the same baseURL logic as better-auth.ts
    const baseURL =
      config.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined) ||
      "http://localhost:3000";

    const basePath = "/api/v1/auth";
    
    const googleRedirectURI = `${baseURL}${basePath}/callback/google`;
    const appleRedirectURI = `${baseURL}${basePath}/callback/apple`;

    const debugInfo = {
      baseURL,
      basePath,
      redirectURIs: {
        google: googleRedirectURI,
        apple: appleRedirectURI,
      },
      environment: {
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV,
      },
      configValues: {
        BETTER_AUTH_URL: config.BETTER_AUTH_URL,
      },
      instructions: {
        step1: "Copy the 'google' redirect URI above (EXACTLY as shown)",
        step2: "Go to Google Cloud Console → APIs & Services → Credentials",
        step3: "Click your OAuth 2.0 Client ID (Eklan AI)",
        step4: "Under 'Authorized redirect URIs', add the exact redirect URI",
        step5: "Remove any old/incorrect redirect URIs",
        step6: "Save and wait 5 minutes to a few hours for changes to propagate",
        important: "The redirect URI must match EXACTLY, including http/https, port, and path",
      },
    };

    logger.info("OAuth Debug Info", debugInfo);

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error: any) {
    logger.error("Debug endpoint failed", { error: error.message });
    return NextResponse.json(
      { error: "Failed to get debug info", details: error.message },
      { status: 500 }
    );
  }
}

