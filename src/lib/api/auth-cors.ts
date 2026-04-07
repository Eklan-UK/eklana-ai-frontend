import { parseWhitelistOrigins } from "./config";

/** Echo preflight `Access-Control-Request-Headers` when present; otherwise allow common Better Auth / fetch headers. */
const DEFAULT_ALLOW_HEADERS =
	"Content-Type, Authorization, Cookie, X-Requested-With, Better-Auth-CSRF, X-Better-Auth";

function isAllowedOrigin(origin: string | null): boolean {
	if (!origin || origin === "null") return false;
	return parseWhitelistOrigins().includes(origin);
}

/**
 * Better Auth does not attach CORS headers to JSON responses. Browsers require them for
 * cross-origin `fetch(..., { credentials: "include" })` (e.g. staging UI → production API).
 * Only origins already allowed via `parseWhitelistOrigins` / `trustedOrigins` get CORS.
 */
export function mergeAuthCorsHeaders(req: Request, res: Response): Response {
	const origin = req.headers.get("origin");
	if (!origin || !isAllowedOrigin(origin)) {
		return res;
	}

	const headers = new Headers(res.headers);
	headers.set("Access-Control-Allow-Origin", origin);
	headers.set("Access-Control-Allow-Credentials", "true");

	const existingVary = headers.get("Vary");
	if (existingVary && !existingVary.split(/\s*,\s*/).includes("Origin")) {
		headers.set("Vary", `${existingVary}, Origin`);
	} else if (!existingVary) {
		headers.set("Vary", "Origin");
	}

	const acrh = req.headers.get("Access-Control-Request-Headers");
	if (acrh) {
		headers.set("Access-Control-Allow-Headers", acrh);
	}

	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers,
	});
}

export function handleAuthCorsPreflight(req: Request): Response {
	const origin = req.headers.get("origin");
	if (!isAllowedOrigin(origin)) {
		return new Response(null, { status: 403 });
	}

	const headers = new Headers();
	headers.set("Access-Control-Allow-Origin", origin!);
	headers.set("Access-Control-Allow-Credentials", "true");
	headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
	);
	const acrh = req.headers.get("Access-Control-Request-Headers");
	if (acrh) {
		headers.set("Access-Control-Allow-Headers", acrh);
	} else {
		headers.set("Access-Control-Allow-Headers", DEFAULT_ALLOW_HEADERS);
	}
	headers.set("Access-Control-Max-Age", "86400");
	headers.set("Vary", "Origin");

	return new Response(null, { status: 204, headers });
}
