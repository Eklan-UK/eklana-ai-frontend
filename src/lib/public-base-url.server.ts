import { headers } from "next/headers";
import {
	getPublicBaseUrlFallback,
	resolvePublicBaseUrlFromHeaders,
} from "@/lib/public-base-url";

/**
 * Public base URL for server components / route handlers (RSC, fetch to own API).
 * Lives in a separate module so `public-base-url.ts` stays importable from the client.
 */
export async function getServerPublicBaseUrl(): Promise<string> {
	const h = await headers();
	return resolvePublicBaseUrlFromHeaders(h) ?? getPublicBaseUrlFallback();
}
