import { config } from 'dotenv';

// Load .env.local first (Next.js convention — takes priority), then .env as fallback.
// This module is imported as a side-effect BEFORE any other imports in scripts so
// that process.env is populated before config.ts evaluates.
config({ path: '.env.local' });
config({ path: '.env' });
