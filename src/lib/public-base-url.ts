import { headers } from "next/headers";

/**
 * Resolve the public origin from proxy / browser headers (no build-time host baked in).
 * Returns null if headers do not contain a usable host.
 */
export function resolvePublicBaseUrlFromHeaders(h: Headers): string | null {
	const hostRaw = h.get("x-forwarded-host") ?? h.get("host") ?? "";
	const host = hostRaw.split(",")[0]?.trim() ?? "";
	if (!host) return null;

	let proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
	if (!proto) {
		proto =
			host.includes("localhost") || host.startsWith("127.")
				? "http"
				: "https";
	}
	return `${proto}://${host}`;
}

/**
 * Runtime fallback for server-only code when request headers are unavailable.
 * Prefer BETTER_AUTH_URL per deployment (not baked into the client bundle).
 */
export function getPublicBaseUrlFallback(): string {
	return (
		process.env.BETTER_AUTH_URL ||
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.NEXT_PUBLIC_API_URL ||
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
		process.env.NEXT_PUBLIC_VERCEL_URL ||
		"http://localhost:3000"
	);
}

/** Same host as the current document (client bundles only). */
export function getBrowserPublicBaseUrl(): string {
	if (typeof window === "undefined") {
		return getPublicBaseUrlFallback();
	}
	return window.location.origin;
}

/**
 * Public base URL for server components / route handlers (RSC, fetch to own API).
 */
export async function getServerPublicBaseUrl(): Promise<string> {
	const h = await headers();
	return resolvePublicBaseUrlFromHeaders(h) ?? getPublicBaseUrlFallback();
}
