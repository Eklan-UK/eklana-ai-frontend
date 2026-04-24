/**
 * Validates GEMINI_API_KEY against the Generative Language API.
 * Google does not expose "paid vs free" in the API; this script only checks
 * that the key works and surfaces quota/rate error text when present.
 *
 * Run from repo root: node scripts/gemini-key-check.mjs
 */
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env") });

const key = process.env.GEMINI_API_KEY?.trim();
const testModel = process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.5-flash-lite";
const base = "https://generativelanguage.googleapis.com/v1beta";

if (!key) {
  console.error("GEMINI_API_KEY is not set in .env (or empty).");
  process.exit(1);
}

console.log("Checking Generative Language API (key redacted)…");

// 1) List a few models
let listStatus = 0;
let listBodyPreview = "";
try {
  const listUrl = `${base}/models?key=${encodeURIComponent(key)}&pageSize=5`;
  const listRes = await fetch(listUrl);
  listStatus = listRes.status;
  const listJson = await listRes.text();
  listBodyPreview = listJson.slice(0, 400);
  if (listRes.ok) {
    const parsed = JSON.parse(listJson);
    const names = (parsed.models || []).map((m) => m.name);
    console.log("listModels: OK, sample model names:", names.slice(0, 5).join(", ") || "(none)");
  } else {
    console.log("listModels: HTTP", listStatus, "—", listBodyPreview.slice(0, 200));
  }
} catch (e) {
  console.log("listModels: error", e?.message || e);
}

// 2) Minimal generate on chat default model
let genStatus = 0;
try {
  const genUrl = `${base}/models/${encodeURIComponent(
    testModel
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const genRes = await fetch(genUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with a single word: ok" }] }],
      generationConfig: { maxOutputTokens: 16, temperature: 0 },
    }),
  });
  genStatus = genRes.status;
  const genJson = await genRes.text();
  if (genRes.ok) {
    const parsed = JSON.parse(genJson);
    const out =
      parsed.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "(no text)";
    console.log(`generateContent (${testModel}): OK — sample output:`, out.slice(0, 80));
  } else {
    console.log(`generateContent (${testModel}): HTTP`, genStatus, "—", genJson.slice(0, 400));
  }
} catch (e) {
  console.log("generateContent: error", e?.message || e);
}

// 3) Heuristic note
console.log("");
console.log("About billing tier: the Generative Language API does not return paid vs free.");
console.log("  • If listModels + generateContent both succeed, the key is valid for this product.");
console.log("  • 429 with quota or RESOURCE_EXHAUSTED often indicates free/test limits; check");
console.log("    Google AI Studio (https://aistudio.google.com/) > Usage, or Google Cloud billing.");
if (listStatus === 200 && genStatus === 200) {
  process.exit(0);
}
process.exit(2);
