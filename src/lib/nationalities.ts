export interface NationalityOption {
  id: string;
  label: string;
  native: string;
  flag: string;
}

/** Single source for nationality picker UIs (onboarding + settings). Selection is stored as `label`. */
/** Order aligns with legacy settings nationality list plus onboarding-only English. */
export const NATIONALITY_OPTIONS: NationalityOption[] = [
  { id: "korean", label: "Korean", native: "한국인", flag: "🇰🇷" },
  { id: "chinese", label: "Chinese", native: "中国人", flag: "🇨🇳" },
  { id: "japanese", label: "Japanese", native: "日本語", flag: "🇯🇵" },
  { id: "spanish", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { id: "french", label: "French", native: "Français", flag: "🇫🇷" },
  { id: "german", label: "German", native: "Deutsch", flag: "🇩🇪" },
  { id: "italian", label: "Italian", native: "Italiano", flag: "🇮🇹" },
  { id: "portuguese", label: "Portuguese", native: "Português", flag: "🇵🇹" },
  { id: "russian", label: "Russian", native: "Русский", flag: "🇷🇺" },
  { id: "arabic", label: "Arabic", native: "العربية", flag: "🇸🇦" },
  { id: "hindi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { id: "english", label: "English", native: "English", flag: "🇺🇸" },
  { id: "other", label: "Other", native: "—", flag: "🌍" },
];
