// Configuration for Next.js API routes

/** Comma-separated `WHITELIST_ORIGINS` env → list (trimmed, empty segments dropped). */
export const parseWhitelistOrigins = (): string[] => {
	const origins: string[] = [];

	const raw = process.env.WHITELIST_ORIGINS?.trim();
	if (raw) {
		origins.push(
			...raw
				.split(',')
				.map((origin) => origin.trim())
				.filter(Boolean),
		);
	}

	// Automatically add Vercel URLs in production
	if (process.env.VERCEL_URL) {
		const vercelUrl = `https://${process.env.VERCEL_URL}`;
		if (!origins.includes(vercelUrl)) {
			origins.push(vercelUrl);
		}
	}

	// Add NEXT_PUBLIC_VERCEL_URL if set
	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		if (!origins.includes(process.env.NEXT_PUBLIC_VERCEL_URL)) {
			origins.push(process.env.NEXT_PUBLIC_VERCEL_URL);
		}
	}

	// Add NEXT_PUBLIC_API_URL if set
	if (process.env.NEXT_PUBLIC_API_URL) {
		if (!origins.includes(process.env.NEXT_PUBLIC_API_URL)) {
			origins.push(process.env.NEXT_PUBLIC_API_URL);
		}
	}

	// Better Auth CORS (trustedOrigins): always merge canonical origins so
	// WHITELIST_ORIGINS / Vercel-only lists cannot omit staging (staging UI → app API).
	const canonicalOrigins = [
		'http://localhost:3000',
		'https://app.eklan.ai',
		'https://staging.eklan.ai',
	];
	for (const o of canonicalOrigins) {
		if (!origins.includes(o)) {
			origins.push(o);
		}
	}

	return origins;
};

/**
 * OAuth client IDs accepted as Google ID token `aud` (web Better Auth + mobile/Expo).
 * Set GOOGLE_CLIENT_IDS (comma-separated) or GOOGLE_CLIENT_ID plus optional
 * GOOGLE_MOBILE_CLIENT_ID / GOOGLE_EXPO_CLIENT_ID.
 */
export const parseGoogleClientIds = (): string[] => {
	const fromList = process.env.GOOGLE_CLIENT_IDS?.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	if (fromList?.length) {
		return [...new Set(fromList)];
	}
	const ids = [
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_MOBILE_CLIENT_ID,
		process.env.GOOGLE_EXPO_CLIENT_ID,
	]
		.map((id) => id?.trim())
		.filter((id): id is string => Boolean(id));
	return [...new Set(ids)];
};

const DEFAULT_FOREVER_PREMIUM_EMAILS = [
	'sa@eklan.ai',
	'bri8kingsley@gmail.com',
	'dv@eklan.ai',
	'afolabi.aanu@gmail.com',
] as const;

/** Hardcoded staff QA accounts + optional FOREVER_PREMIUM_EMAILS env (comma-separated). */
export const parseForeverPremiumEmails = (): string[] => {
	const emails = new Set(
		DEFAULT_FOREVER_PREMIUM_EMAILS.map((email) => email.toLowerCase()),
	);

	const raw = process.env.FOREVER_PREMIUM_EMAILS?.trim();
	if (raw) {
		for (const email of raw
			.split(',')
			.map((value) => value.trim().toLowerCase())
			.filter(Boolean)) {
			emails.add(email);
		}
	}

	return [...emails];
};

export const config = {
	NODE_ENV: process.env.NODE_ENV || 'development',
	WHITELIST_ORIGINS: parseWhitelistOrigins(),
	MONGO_URI: process.env.MONGO_URI,
	LOG_LEVEL: process.env.LOG_LEVEL || 'info',
	JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
	JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
	ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY,
	REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY,
	WHITELIST_ADMINS_MAILS: ['gideons564@gmail.com'],
	FOREVER_PREMIUM_EMAILS: parseForeverPremiumEmails(),
	SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
	SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456',
	SUPER_ADMIN_FIRST_NAME: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
	SUPER_ADMIN_LAST_NAME: process.env.SUPER_ADMIN_LAST_NAME || 'Admin',
	defaultResLimit: 20,
	defaultResOffset: 0,
	// Better Auth Configuration
	BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 
		process.env.NEXT_PUBLIC_API_URL || 
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
		process.env.NEXT_PUBLIC_VERCEL_URL || 
		'http://localhost:3000',
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || process.env.JWT_ACCESS_SECRET,
	// OAuth: Better Auth sign-in (Google login only — no Calendar scopes)
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	/** All client IDs valid for POST /api/v1/auth/verify-id-token (web + mobile). */
	GOOGLE_CLIENT_IDS: parseGoogleClientIds(),
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	// OAuth: Tutor Google Calendar connect (separate Google Cloud OAuth client)
	GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
	GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
	APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
	APPLE_CLIENT_SECRET: process.env.APPLE_CLIENT_SECRET,
	APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
	APPLE_KEY_ID: process.env.APPLE_KEY_ID,
	APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
	// Eleven Labs TTS
	ELEVEN_LABS_API_KEY: process.env.ELEVEN_LABS_API_KEY,
	// Cloudinary Configuration
	CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
	CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
	CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
	// Google Gemini AI
	GEMINI_API_KEY: process.env.GEMINI_API_KEY,
	/** Low-latency model for text chat + streaming. Override via GEMINI_CHAT_MODEL env var. */
	GEMINI_CHAT_MODEL:
		process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-2.5-flash-lite',
	/** Post-session JSON summary. Override via GEMINI_SUMMARY_MODEL. */
	GEMINI_SUMMARY_MODEL:
		process.env.GEMINI_SUMMARY_MODEL?.trim() || 'gemini-2.5-flash',
	/** If primary summary model fails, try this (see summary.service). */
	GEMINI_SUMMARY_FALLBACK_MODEL:
		process.env.GEMINI_SUMMARY_FALLBACK_MODEL?.trim() ||
		'gemini-2.5-flash-lite',
	/**
	 * Native Gemini TTS (free-talk, etc.). Prefer a lighter / preview model first
	 * to keep latency and quota lower; 3.1 TTS is often a separate, tighter daily cap.
	 */
	GEMINI_TTS_MODEL_PRIMARY:
		process.env.GEMINI_TTS_MODEL_PRIMARY?.trim() || 'gemini-2.5-flash-preview-tts',
	GEMINI_TTS_MODEL_FALLBACK:
		process.env.GEMINI_TTS_MODEL_FALLBACK?.trim() || 'gemini-3.1-flash-tts-preview',
	// Stripe
	STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
	STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
	/** Monthly Pro (~US$1.99). All new Checkouts use this Price ID. */
	STRIPE_PREMIUM_MONTHLY_PRICE_ID: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
	// Apple In-App Purchase (App Store Server API — separate from Sign in with Apple OAuth)
	APPLE_APP_STORE_ISSUER_ID: process.env.APPLE_APP_STORE_ISSUER_ID,
	APPLE_APP_STORE_KEY_ID: process.env.APPLE_APP_STORE_KEY_ID,
	APPLE_APP_STORE_PRIVATE_KEY: process.env.APPLE_APP_STORE_PRIVATE_KEY,
	APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID,
	APPLE_PRO_MONTHLY_PRODUCT_ID: process.env.APPLE_PRO_MONTHLY_PRODUCT_ID,
	APPLE_APP_STORE_SHARED_SECRET: process.env.APPLE_APP_STORE_SHARED_SECRET,
	/** No default — must be explicitly "production" or "sandbox". See getAppleEnvironment() in apple-app-store.service.ts. */
	APPLE_APP_STORE_ENVIRONMENT: process.env.APPLE_APP_STORE_ENVIRONMENT,
	/** Required by SignedDataVerifier in Production only (numeric App Store app id). */
	APPLE_APP_APPLE_ID: process.env.APPLE_APP_APPLE_ID,
	// OpenAI
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	// eklan-live-relay (Gemini Live API relay service)
	RELAY_URL: process.env.RELAY_URL,
	RELAY_AUTH_SECRET: process.env.RELAY_AUTH_SECRET,
	// Speechace Configuration
	SPEECHACE_API_KEY:
		process.env.SPEECHACE_API_KEY ||
		'WkctOEzrFouPkyYcp91FO%2Ft3rfbidCLLVnBqlm%2FpCsZQ2mGJsNUgehSikMOPL%2FkUz0gWpbzK8jNHgn8TTZkRzNKhUQzZG9%2BCCUwuiOO%2Bt84j8mHgiBa%2BJPr1Id4bZnMm',
	SPEECHACE_API_ENDPOINT: process.env.SPEECHACE_API_ENDPOINT || 'https://api.speechace.co',
};

export default config;
