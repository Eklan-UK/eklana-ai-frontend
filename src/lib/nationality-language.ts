/**
 * Display names persisted as profile.language; aligned with Settings > App Language.
 */
export const APP_INTERFACE_LANGUAGE_NAMES = [
  "English",
  "Korean",
  "Chinese",
  "Japanese",
  "Spanish",
  "French",
] as const;

export type AppInterfaceLanguageName =
  (typeof APP_INTERFACE_LANGUAGE_NAMES)[number];

const DIRECT_NATIONALITY_TO_LANGUAGE: Record<string, AppInterfaceLanguageName> =
  {
    Korean: "Korean",
    Chinese: "Chinese",
    Japanese: "Japanese",
    Spanish: "Spanish",
    French: "French",
    English: "English",
  };

export function nationalityLabelToAppLanguage(
  label: string
): AppInterfaceLanguageName {
  const key = label.trim();
  if (!key) return "English";
  return DIRECT_NATIONALITY_TO_LANGUAGE[key] ?? "English";
}

/** True when picking this nationality would imply a different app language than the user has now. */
export function shouldOfferLanguageSwitchForNationality(
  nationalityLabel: string,
  currentAppLanguage?: string | null
): boolean {
  const suggested = nationalityLabelToAppLanguage(nationalityLabel);
  const current = (currentAppLanguage ?? "English").trim();
  return suggested !== current;
}
