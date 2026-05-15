/**
 * Shared URL helpers safe for client and server bundles.
 * Do not import `next/headers` here — that breaks client imports (e.g. auth-client).
 */

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
 * Runtime fallback when request headers are unavailable.
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

/** Same host as the current document (browser); SSR fallback uses env chain. */
export function getBrowserPublicBaseUrl(): string {
	if (typeof window === "undefined") {
		return getPublicBaseUrlFallback();
	}
	return window.location.origin;
}

/**
 * Normalize the origin used for server-side fetch() to this app's own routes.
 * - `0.0.0.0` is not a reliable outbound target in Node/undici.
 * - `localhost` may resolve to `::1` while the dev server listens on IPv4 only → ECONNREFUSED ("fetch failed").
 */
export function normalizePublicOriginForServerFetch(origin: string): string {
	const trimmed = origin.trim().replace(/\/$/, "");
	try {
		const u = new URL(trimmed);
		if (u.hostname === "0.0.0.0") {
			u.hostname = "127.0.0.1";
		} else if (u.hostname === "localhost") {
			u.hostname = "127.0.0.1";
		} else if (u.hostname === "[::1]") {
			u.hostname = "127.0.0.1";
		}
		return u.origin;
	} catch {
		return trimmed;
	}
}
