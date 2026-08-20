import { z } from 'zod';
import { COMPETENCY_FRAMEWORK } from '@/config/competency-framework';
import { isValidPhase, type ScenarioPhase, type ScenarioHint } from '@/domain/simulation/simulation-scenario-extraction.service';

const scenarioScriptField = z.string().transform((raw, ctx) => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'scenarioScript must be valid JSON',
		});
		return z.NEVER;
	}

	if (!Array.isArray(parsed) || parsed.length === 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'scenarioScript must be a non-empty array',
		});
		return z.NEVER;
	}

	if (!parsed.every(isValidPhase)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'scenarioScript contains a malformed phase',
		});
		return z.NEVER;
	}

	return parsed as ScenarioPhase[];
});

function isValidHintShape(value: unknown): value is ScenarioHint {
	if (typeof value !== 'object' || value === null) return false;
	const hint = value as Record<string, unknown>;
	return (
		typeof hint.phaseTitle === 'string' &&
		hint.phaseTitle.trim().length > 0 &&
		typeof hint.hintText === 'string' &&
		hint.hintText.trim().length > 0
	);
}

const hintsField = z
	.string()
	.optional()
	.transform((raw) => raw ?? '[]')
	.transform((raw, ctx) => {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'hints must be valid JSON',
			});
			return z.NEVER;
		}

		if (!Array.isArray(parsed)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'hints must be an array',
			});
			return z.NEVER;
		}

		if (!parsed.every(isValidHintShape)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'hints contains a malformed entry',
			});
			return z.NEVER;
		}

		return parsed as ScenarioHint[];
	});

export const simulationScenarioBodySchema = z
	.object({
		workplaceSetting: z.string().min(1, 'Workplace setting is required'),
		dramatisationPrompt: z.string().min(1, 'Dramatisation prompt is required'),
		studentCharacterName: z.string().min(1, 'Student character name is required'),
		topicId: z.string().refine((id) => id in COMPETENCY_FRAMEWORK, 'Invalid topic'),
		gradingRubric: z.string().min(1, 'Grading rubric is required'),
		maxDurationMinutes: z.coerce.number().int().positive().default(15),
		assignedLearnerIds: z.array(z.string()).min(1, 'Select at least one learner'),
		background: z.string().min(1, 'Background is required'),
		patientInformation: z.string().min(1, 'Patient information is required'),
		scenarioScript: scenarioScriptField,
		hints: hintsField,
	})
	.refine(
		(body) => {
			const phaseTitles = new Set(body.scenarioScript.map((phase) => phase.phaseTitle));
			return body.hints.every((hint) => phaseTitles.has(hint.phaseTitle));
		},
		{ message: 'Each hint must reference a phase title that exists in scenarioScript' },
	);

export type SimulationScenarioBody = z.infer<typeof simulationScenarioBodySchema>;

// Used by POST /api/v1/admin/simulation/scenarios/extract — the preview/pre-fill
// endpoint only needs the student character name (required by the extraction
// prompt) alongside the uploaded file, which is validated in the route itself.
export const simulationScenarioExtractBodySchema = z.object({
	studentCharacterName: z.string().min(1, 'Student character name is required'),
});

export type SimulationScenarioExtractBody = z.infer<typeof simulationScenarioExtractBodySchema>;
