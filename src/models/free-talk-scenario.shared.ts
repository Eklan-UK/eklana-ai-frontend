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
