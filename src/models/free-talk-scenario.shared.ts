export const FREE_TALK_SCENARIO_TYPES = [
	'icu_emergency',
	'cpr',
	'patient_follow_up',
	'admission',
	'small_talk_patient',
	'handover_receive',
	'handover',
	'decline_request',
	'small_talk_colleague',
	'phone_doctor',
	'doctor_rounds',
	'phone_colleague',
	'phone_department',
	'family_questions',
	'phone_family',
	'discharge',
	'grammar',
] as const;

export type FreeTalkScenarioType = (typeof FREE_TALK_SCENARIO_TYPES)[number];

export const FREE_TALK_SCENARIO_TYPE_LABELS: Record<FreeTalkScenarioType, string> = {
	icu_emergency: 'ICU Emergency',
	cpr: 'Conducting CPR',
	patient_follow_up: 'Follow-up with Patients',
	admission: 'Admission',
	small_talk_patient: 'Small Talk — Patient',
	handover_receive: 'Receiving a Handover',
	handover: 'Giving a Handover',
	decline_request: 'Decline Request',
	small_talk_colleague: 'Small Talk — Colleague',
	phone_doctor: 'Phone the Doctor',
	doctor_rounds: 'Going on Rounds with Doctors',
	phone_colleague: 'Phone Communication with Colleagues',
	phone_department: 'Phone Communication with Other Departments',
	family_questions: "Answering Families' and Friends' Questions",
	phone_family: "Phone Communication with the Patient's Families",
	discharge: 'Discharging Patients',
	grammar: 'Grammar',
};

/** Normalize `include` / `usefulPhrases` from pasted text, JSON strings, or legacy array shapes. */
export {
	normalizeFreeTalkScenarioStringList,
	freeTalkStringListToMultiline,
} from '@/lib/free-talk-scenario-lists';
