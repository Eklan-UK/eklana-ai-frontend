export interface LanguageOption {
  locale: string;
  name: string;
  native: string;
}

/**
 * Native-language picker options (distinct from app interface language).
 * Values are stored as `profile.nativeLanguage` (display name).
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { locale: "en", name: "English", native: "English" },
  { locale: "ar", name: "Arabic", native: "العربية" },
  { locale: "zh", name: "Chinese (Simplified)", native: "简体中文" },
  { locale: "fr", name: "French", native: "Français" },
  { locale: "de", name: "German", native: "Deutsch" },
  { locale: "hi", name: "Hindi", native: "हिन्दी" },
  { locale: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { locale: "it", name: "Italian", native: "Italiano" },
  { locale: "ja", name: "Japanese", native: "日本語" },
  { locale: "ko", name: "Korean", native: "한국어" },
  { locale: "ms", name: "Malay", native: "Bahasa Melayu" },
  { locale: "pl", name: "Polish", native: "Polski" },
  { locale: "pt", name: "Portuguese", native: "Português" },
  { locale: "ro", name: "Romanian", native: "Română" },
  { locale: "ru", name: "Russian", native: "Русский" },
  { locale: "es", name: "Spanish", native: "Español" },
  { locale: "sv", name: "Swedish", native: "Svenska" },
  { locale: "th", name: "Thai", native: "ภาษาไทย" },
  { locale: "tr", name: "Turkish", native: "Türkçe" },
  { locale: "uk", name: "Ukrainian", native: "Українська" },
  { locale: "vi", name: "Vietnamese", native: "Tiếng Việt" },
];
