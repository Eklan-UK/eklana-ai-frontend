import { headers } from "next/headers";
import {
	getPublicBaseUrlFallback,
	normalizePublicOriginForServerFetch,
	resolvePublicBaseUrlFromHeaders,
} from "@/lib/public-base-url";

/**
 * Public base URL for server components / route handlers (RSC, fetch to own API).
 * Lives in a separate module so `public-base-url.ts` stays importable from the client.
 *
 * Optional `SERVER_FETCH_BASE_URL` overrides the origin for same-origin server fetches
 * (tunnels, Docker, or IPv4/IPv6 localhost mismatches).
 */
export async function getServerPublicBaseUrl(): Promise<string> {
	const override = process.env.SERVER_FETCH_BASE_URL?.trim();
	if (override) {
		return normalizePublicOriginForServerFetch(override);
	}
	const h = await headers();
	const base =
		resolvePublicBaseUrlFromHeaders(h) ?? getPublicBaseUrlFallback();
	return normalizePublicOriginForServerFetch(base);
}
