import { z } from 'zod';

const weeklyFocusField = z.string().transform((raw, ctx) => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'weeklyFocus must be valid JSON',
		});
		return z.NEVER;
	}

	if (
		!Array.isArray(parsed) ||
		parsed.length === 0 ||
		!parsed.every((item) => typeof item === 'string')
	) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'weeklyFocus must be a non-empty array of strings',
		});
		return z.NEVER;
	}

	return parsed;
});

export const simulationScenarioBodySchema = z.object({
	title: z.string().min(1, 'Title is required').max(200),
	workplaceSetting: z.string().min(1, 'Workplace setting is required'),
	dramatisationPrompt: z.string().min(1, 'Dramatisation prompt is required'),
	weeklyFocus: weeklyFocusField,
	gradingRubric: z.string().min(1, 'Grading rubric is required'),
	maxDurationMinutes: z.coerce.number().int().positive().default(15),
	assignedLearnerIds: z.array(z.string()).min(1, 'Select at least one learner'),
});

export type SimulationScenarioBody = z.infer<typeof simulationScenarioBodySchema>;
