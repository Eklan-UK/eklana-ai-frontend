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
	// Speechace Configuration
	SPEECHACE_API_KEY:
		process.env.SPEECHACE_API_KEY ||
		'WkctOEzrFouPkyYcp91FO%2Ft3rfbidCLLVnBqlm%2FpCsZQ2mGJsNUgehSikMOPL%2FkUz0gWpbzK8jNHgn8TTZkRzNKhUQzZG9%2BCCUwuiOO%2Bt84j8mHgiBa%2BJPr1Id4bZnMm',
	SPEECHACE_API_ENDPOINT: process.env.SPEECHACE_API_ENDPOINT || 'https://api.speechace.co',
};

export default config;
