/** BCP 47-ish tags for `next-intl` and `<html lang>`. */
export const SUPPORTED_LOCALES = ["en", "ko", "zh", "ja", "es", "fr"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Stored profile.language values — must match Settings > App Language. */
const PROFILE_LANGUAGE_TO_LOCALE: Record<string, AppLocale> = {
  English: "en",
  Korean: "ko",
  Chinese: "zh",
  Japanese: "ja",
  Spanish: "es",
  French: "fr",
};

const LOCALE_TO_PROFILE_LANGUAGE: Record<AppLocale, string> = {
  en: "English",
  ko: "Korean",
  zh: "Chinese",
  ja: "Japanese",
  es: "Spanish",
  fr: "French",
};

export function profileLanguageToLocale(
  profileLanguage: string | undefined | null
): AppLocale {
  const key = profileLanguage?.trim();
  if (!key) return DEFAULT_LOCALE;
  return PROFILE_LANGUAGE_TO_LOCALE[key] ?? DEFAULT_LOCALE;
}

export function localeToProfileLanguage(locale: string): string {
  const l = locale as AppLocale;
  if (SUPPORTED_LOCALES.includes(l)) return LOCALE_TO_PROFILE_LANGUAGE[l];
  return "English";
}

export function htmlLangFromLocale(locale: AppLocale): string {
  switch (locale) {
    case "zh":
      return "zh-Hans";
    default:
      return locale;
  }
}
