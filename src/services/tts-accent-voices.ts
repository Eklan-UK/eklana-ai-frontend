/**
 * Shared accent → ElevenLabs voice map for drill pre-gen TTS,
 * student lesson preferences, free-talk TTS, and /api/v1/tts.
 */

export const ACCENT_VOICE_KEYS = [
  'aanu_afolabi',
  'american_male',
  'american_female',
  'american_arthur',
  'american_joel',
  'american_jeff',
  'american_amanda',
  'american_marcia',
  'american_hannah',
  'british_male',
  'british_female',
  'british_ben',
  'british_elliott',
  'british_olivia',
  'british_rebecca',
  'australian_male',
  'australian_female',
  'australian_jake',
  'australian_stephen',
  'australian_peter',
  'australian_lily',
  'australian_sophia',
  'australian_pauline',
  'canadian_male',
  'canadian_female',
  'canadian_cody',
  'canadian_gavin',
  'canadian_robert',
  'canadian_katie',
  'canadian_lena',
  'canadian_myriam',
  'newzealand_male',
  'newzealand_female',
  'newzealand_benji',
  'newzealand_cassandra',
  'southafrican_male',
  'southafrican_female',
  'southafrican_andrew',
  'southafrican_linet',
] as const;

export type AccentVoiceKey = (typeof ACCENT_VOICE_KEYS)[number];

export type AccentVoiceGroup =
  | 'featured'
  | 'american'
  | 'british'
  | 'australian'
  | 'canadian'
  | 'newzealand'
  | 'southafrican';

/** Ordered country/featured sections for selects and sheets. */
export const ACCENT_VOICE_GROUPS: ReadonlyArray<{
  id: AccentVoiceGroup;
  label: string;
}> = [
  { id: 'featured', label: 'Featured' },
  { id: 'american', label: 'American' },
  { id: 'british', label: 'British' },
  { id: 'australian', label: 'Australian' },
  { id: 'canadian', label: 'Canadian' },
  { id: 'newzealand', label: 'New Zealand' },
  { id: 'southafrican', label: 'South African' },
];

export interface AccentVoiceOption {
  key: AccentVoiceKey;
  label: string;
  voiceId: string;
  group: AccentVoiceGroup;
  /** Pre-generated Cloudinary sample for the drill-builder preview dialog. */
  previewAudioUrl?: string;
}

/**
 * Fixed sample line for all voice previews so accents are comparable.
 * Used by scripts/generate-voice-previews.ts and VoicePreviewDialog.
 */
export const VOICE_PREVIEW_SAMPLE_TEXT =
  'Hi there. This is how I sound when I speak English.';

/** Default student lesson accent when unset / new. */
export const DEFAULT_ENGLISH_ACCENT: AccentVoiceKey = 'british_female';

/**
 * Student accent picker for onboarding + lesson settings (not the full voice catalog).
 * One option per country (6); stored keys are `{country}_female`. Keep in sync with
 * mobile/utils/tts-accent-voices.ts. Admin/tutor builders use ACCENT_VOICE_OPTIONS.
 */
export interface OnboardingAccentOption {
  key: AccentVoiceKey;
  label: string;
  flag: string;
}

export const ONBOARDING_ACCENT_OPTIONS: ReadonlyArray<OnboardingAccentOption> = [
  { key: 'american_female', label: 'American', flag: '🇺🇸' },
  { key: 'british_female', label: 'British', flag: '🇬🇧' },
  { key: 'australian_female', label: 'Australian', flag: '🇦🇺' },
  { key: 'canadian_female', label: 'Canadian', flag: '🇨🇦' },
  { key: 'newzealand_female', label: 'New Zealand', flag: '🇳🇿' },
  { key: 'southafrican_female', label: 'South African', flag: '🇿🇦' },
];

export const ACCENT_VOICE_OPTIONS: AccentVoiceOption[] = [
  // Featured
  { key: 'aanu_afolabi', label: 'Aanu Afolabi', voiceId: 'JXNr0OLVF2ZRyBK6ZXkK', group: 'featured', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717684/eklan/voice-previews/aanu_afolabi.mp3' },
  // American
  { key: 'american_male', label: 'American (male)', voiceId: 'Z2fsAwk7IblvPhYzfslC', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717688/eklan/voice-previews/american_male.mp3' },
  { key: 'american_female', label: 'American (female)', voiceId: 'DXFkLCBUTmvXpp2QwZjA', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717691/eklan/voice-previews/american_female.mp3' },
  { key: 'american_arthur', label: 'Arthur (male)', voiceId: 'TtRFBnwQdH1k01vR0hMz', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717696/eklan/voice-previews/american_arthur.mp3' },
  { key: 'american_joel', label: 'Joel (male)', voiceId: 'Xju4Klbc1r0SkckSAl5Q', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717701/eklan/voice-previews/american_joel.mp3' },
  { key: 'american_jeff', label: 'Jeff (male)', voiceId: 'dUdaTcCeBJKScrY9EdRg', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717709/eklan/voice-previews/american_jeff.mp3' },
  { key: 'american_amanda', label: 'Amanda (female)', voiceId: 'mfEsG59glUDFMvTcpYbn', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717714/eklan/voice-previews/american_amanda.mp3' },
  { key: 'american_marcia', label: 'Marcia (female)', voiceId: 'jmovCppyUT0hdwQb6rmj', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717719/eklan/voice-previews/american_marcia.mp3' },
  { key: 'american_hannah', label: 'Hannah (female)', voiceId: 'ZSNL4hPqCnqoMPaI4jGX', group: 'american', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717722/eklan/voice-previews/american_hannah.mp3' },
  // British
  { key: 'british_male', label: 'British (male)', voiceId: 'JZ5PEPqtr05GbBRBqPhz', group: 'british', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717726/eklan/voice-previews/british_male.mp3' },
  { key: 'british_female', label: 'British (female)', voiceId: 'LZAcK8Cx5QjdQhfBsJQZ', group: 'british', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717729/eklan/voice-previews/british_female.mp3' },
  { key: 'british_ben', label: 'Ben (male)', voiceId: 'eUlIljct4YrEQRcEqrii', group: 'british', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717734/eklan/voice-previews/british_ben.mp3' },
  { key: 'british_elliott', label: 'Elliott (male)', voiceId: '0eNfhIaWmmTRBCR4uMbx', group: 'british', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717738/eklan/voice-previews/british_elliott.mp3' },
  { key: 'british_olivia', label: 'Olivia (female)', voiceId: 'zq2ECz14SgU0AaAOer0a', group: 'british', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717742/eklan/voice-previews/british_olivia.mp3' },
  { key: 'british_rebecca', label: 'Rebecca (female)', voiceId: 'zNe9OWjmOg3L7EgrhkJw', group: 'british', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717747/eklan/voice-previews/british_rebecca.mp3' },
  // Australian
  { key: 'australian_male', label: 'Australian (male)', voiceId: 'hIreuBly94QFepU63yel', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717752/eklan/voice-previews/australian_male.mp3' },
  { key: 'australian_female', label: 'Australian (female)', voiceId: 'VyyyOgRmsqOzaZXnKWnI', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717757/eklan/voice-previews/australian_female.mp3' },
  { key: 'australian_jake', label: 'Jake (male)', voiceId: 'MqjGm3q7AXXLcz9bU8W3', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717761/eklan/voice-previews/australian_jake.mp3' },
  { key: 'australian_stephen', label: 'Stephen (male)', voiceId: 'kdW6CDutGqpjwCpviBac', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717767/eklan/voice-previews/australian_stephen.mp3' },
  { key: 'australian_peter', label: 'Peter (male)', voiceId: 'oKDz3nEzNfwKIVvUwPs0', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717772/eklan/voice-previews/australian_peter.mp3' },
  { key: 'australian_lily', label: 'Lily (female)', voiceId: '0QT4OrDTvpDlUPmFsUWN', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717778/eklan/voice-previews/australian_lily.mp3' },
  { key: 'australian_sophia', label: 'Sophia (female)', voiceId: 'LtPsVjX1k0Kl4StEMZPK', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717782/eklan/voice-previews/australian_sophia.mp3' },
  { key: 'australian_pauline', label: 'Pauline (female)', voiceId: 'Rpg8Sn3cVL1f8658yYm2', group: 'australian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717787/eklan/voice-previews/australian_pauline.mp3' },
  // Canadian
  { key: 'canadian_male', label: 'Canadian (male)', voiceId: 'FyYFoP6qNryBV7G8rnI9', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717793/eklan/voice-previews/canadian_male.mp3' },
  { key: 'canadian_female', label: 'Canadian (female)', voiceId: '3T3dPoABJjGZZAI1eif7', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717797/eklan/voice-previews/canadian_female.mp3' },
  { key: 'canadian_cody', label: 'Cody (male)', voiceId: '9XfYMbJVZqPHaQtYnTAO', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717802/eklan/voice-previews/canadian_cody.mp3' },
  { key: 'canadian_gavin', label: 'Gavin (male)', voiceId: 'DMljQdXAGELCjF2K6UHK', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717808/eklan/voice-previews/canadian_gavin.mp3' },
  { key: 'canadian_robert', label: 'Robert (male)', voiceId: 'A41HRDgOrF1mgUtjuSGM', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717811/eklan/voice-previews/canadian_robert.mp3' },
  { key: 'canadian_katie', label: 'Katie (female)', voiceId: 'jdrqQ2ZMWENd1cuRByWG', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717816/eklan/voice-previews/canadian_katie.mp3' },
  { key: 'canadian_lena', label: 'Lena (female)', voiceId: 'roYauZ4bOLAKvVZTPLre', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717820/eklan/voice-previews/canadian_lena.mp3' },
  { key: 'canadian_myriam', label: 'Myriam (female)', voiceId: 'H8BjWxFjrzNszTO74noq', group: 'canadian', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717824/eklan/voice-previews/canadian_myriam.mp3' },
  // New Zealand
  { key: 'newzealand_male', label: 'New Zealand (male)', voiceId: 'HMphu9BbJxx67elXp4YY', group: 'newzealand', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717849/eklan/voice-previews/newzealand_male.mp3' },
  { key: 'newzealand_female', label: 'New Zealand (female)', voiceId: 'pcKdPWtbF6bM9o7NHjCI', group: 'newzealand', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717861/eklan/voice-previews/newzealand_female.mp3' },
  { key: 'newzealand_benji', label: 'Benji (male)', voiceId: 'wWUG72eEtupiUkpXafwX', group: 'newzealand', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717873/eklan/voice-previews/newzealand_benji.mp3' },
  { key: 'newzealand_cassandra', label: 'Cassandra Woodhouse (female)', voiceId: 'A3TiUH9xcSptIzvOUBnB', group: 'newzealand', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717889/eklan/voice-previews/newzealand_cassandra.mp3' },
  // South African
  { key: 'southafrican_male', label: 'South African (male)', voiceId: 'YPtbPhafrxFTDAeaPP4w', group: 'southafrican', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717901/eklan/voice-previews/southafrican_male.mp3' },
  { key: 'southafrican_female', label: 'South African (female)', voiceId: '0zUZ5qUGb8wympsfJH8d', group: 'southafrican', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717920/eklan/voice-previews/southafrican_female.mp3' },
  { key: 'southafrican_andrew', label: 'Andrew (male)', voiceId: 'P1LmKcX63Ihgqy11sVRt', group: 'southafrican', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717931/eklan/voice-previews/southafrican_andrew.mp3' },
  { key: 'southafrican_linet', label: 'Linet (female)', voiceId: '7Ojkrcr68EynjSd90VK0', group: 'southafrican', previewAudioUrl: 'https://res.cloudinary.com/dzr3vlosq/video/upload/v1786717945/eklan/voice-previews/southafrican_linet.mp3' },
];

const VOICE_ID_BY_KEY = Object.fromEntries(
  ACCENT_VOICE_OPTIONS.map((o) => [o.key, o.voiceId]),
) as Record<AccentVoiceKey, string>;

const KEY_SET = new Set<string>(ACCENT_VOICE_KEYS);

/** Legacy lesson preference values → current key map. */
const LEGACY_ACCENT_MAP: Record<string, AccentVoiceKey> = {
  british: 'british_female',
  american: 'american_female',
  indian_male: 'british_female',
  indian_female: 'british_female',
};

export function isAccentVoiceKey(key: unknown): key is AccentVoiceKey {
  return typeof key === 'string' && KEY_SET.has(key);
}

const STUDENT_LESSON_ACCENT_KEYS = new Set<string>(
  ONBOARDING_ACCENT_OPTIONS.map((o) => o.key),
);

/** Country accents students may set in lesson prefs / onboarding (`*_female` keys). */
export type StudentLessonAccentKey =
  | 'american_female'
  | 'british_female'
  | 'australian_female'
  | 'canadian_female'
  | 'newzealand_female'
  | 'southafrican_female';

const STUDENT_COUNTRY_PREFIXES = [
  'american',
  'british',
  'australian',
  'canadian',
  'newzealand',
  'southafrican',
] as const;

type StudentCountryPrefix = (typeof STUDENT_COUNTRY_PREFIXES)[number];

/** True when key is one of the six student country accents. */
export function isStudentLessonAccentKey(
  key: unknown,
): key is StudentLessonAccentKey {
  return typeof key === 'string' && STUDENT_LESSON_ACCENT_KEYS.has(key);
}

/**
 * Normalize stored englishAccent (including legacy british/american) to a current key.
 * Returns undefined when empty / unknown.
 */
export function normalizeEnglishAccent(
  key?: string | null,
): AccentVoiceKey | undefined {
  if (!key || !key.trim()) return undefined;
  const trimmed = key.trim();
  if (isAccentVoiceKey(trimmed)) return trimmed;
  return LEGACY_ACCENT_MAP[trimmed];
}

function studentCountryPrefix(
  key: string,
): StudentCountryPrefix | undefined {
  for (const prefix of STUDENT_COUNTRY_PREFIXES) {
    if (key === prefix || key.startsWith(`${prefix}_`)) return prefix;
  }
  return undefined;
}

/**
 * Map any stored accent/character key → student country accent (`{country}_female`).
 * Male, character, and legacy keys coerce to that country's female voice.
 * Featured/unknown → DEFAULT_ENGLISH_ACCENT.
 */
export function toStudentLessonAccent(key?: string | null): AccentVoiceKey {
  const normalized = normalizeEnglishAccent(key);
  if (!normalized) return DEFAULT_ENGLISH_ACCENT;
  if (isStudentLessonAccentKey(normalized)) return normalized;
  const country = studentCountryPrefix(normalized);
  if (!country) return DEFAULT_ENGLISH_ACCENT;
  return `${country}_female` as StudentLessonAccentKey;
}

/**
 * Resolve an accent key to an ElevenLabs voice ID.
 * Returns undefined for empty/unknown keys (caller should fall back to env default).
 */
export function resolveAccentVoiceId(key?: string | null): string | undefined {
  const normalized = normalizeEnglishAccent(key);
  if (!normalized) return undefined;
  return VOICE_ID_BY_KEY[normalized];
}
