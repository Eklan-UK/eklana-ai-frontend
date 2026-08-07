export { PrecisionClinicRepository, buildClinicListQuery, countClinicPracticeItems } from './precision-clinic.repository';
export { PrecisionClinicService } from './precision-clinic.service';
export { generateClinicDrillContent } from './clinic-ai-generator.service';
export type {
	PrecisionClinicDrill,
	PrecisionClinicListFilters,
	CreatePrecisionClinicDrillData,
	UpdatePrecisionClinicDrillData,
	PrecisionClinicStats,
	PrecisionClinicListResult,
	PrecisionClinicDrillType,
	PrecisionClinicDifficulty,
	PrecisionClinicPublishStatus,
	ClinicSoundGroup,
	ClinicKeyPhraseQuestion,
	ClinicMatchingPair,
	ClinicGrammarPattern,
	ClinicSentenceWritingWord,
} from './types';
export {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DIFFICULTIES,
	PRECISION_CLINIC_DRILL_TYPE_LABELS,
} from './types';
