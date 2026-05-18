export const FREE_TALK_SCENARIO_TYPES = [
	'icu_emergency',
	'admission',
	'small_talk_patient',
	'handover',
	'decline_request',
	'phone_doctor',
	'small_talk_colleague',
] as const;

export type FreeTalkScenarioType = (typeof FREE_TALK_SCENARIO_TYPES)[number];

/** Normalize `include` / `usefulPhrases` from pasted text, JSON strings, or legacy array shapes. */
export {
	normalizeFreeTalkScenarioStringList,
	freeTalkStringListToMultiline,
} from '@/lib/free-talk-scenario-lists';
