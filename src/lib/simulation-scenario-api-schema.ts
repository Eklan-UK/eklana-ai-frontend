import { z } from 'zod';
import { COMPETENCY_FRAMEWORK } from '@/config/competency-framework';
import { isValidPhase, type ScenarioPhase } from '@/domain/simulation/simulation-scenario-extraction.service';

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

export const simulationScenarioBodySchema = z.object({
	title: z.string().min(1, 'Title is required').max(200),
	workplaceSetting: z.string().min(1, 'Workplace setting is required'),
	dramatisationPrompt: z.string().min(1, 'Dramatisation prompt is required'),
	studentCharacterName: z.string().min(1, 'Student character name is required'),
	topicId: z.string().refine((id) => id in COMPETENCY_FRAMEWORK, 'Invalid topic'),
	gradingRubric: z.string().min(1, 'Grading rubric is required'),
	maxDurationMinutes: z.coerce.number().int().positive().default(15),
	assignedLearnerIds: z.array(z.string()).min(1, 'Select at least one learner'),
	displayData: z.string().min(1, 'Background / Briefing is required'),
	scenarioScript: scenarioScriptField,
	studentHint: z.string().optional().default(''),
});

export type SimulationScenarioBody = z.infer<typeof simulationScenarioBodySchema>;

// Used by POST /api/v1/admin/simulation/scenarios/extract — the preview/pre-fill
// endpoint only needs the student character name (required by the extraction
// prompt) alongside the uploaded file, which is validated in the route itself.
export const simulationScenarioExtractBodySchema = z.object({
	studentCharacterName: z.string().min(1, 'Student character name is required'),
});

export type SimulationScenarioExtractBody = z.infer<typeof simulationScenarioExtractBodySchema>;
