import { z } from 'zod';
import { FREE_TALK_SCENARIO_TYPES } from '@/models/free-talk-scenario.shared';
import { normalizeFreeTalkScenarioStringList } from '@/lib/free-talk-scenario-lists';
import { normalizeAssignedLearnerIds } from '@/lib/free-talk-scenario-assignment';
import { parseFreeTalkCompletionDateInput } from '@/lib/free-talk-scenario-completion';
import { Types } from 'mongoose';

const completionDateField = z
	.union([z.string().min(1), z.coerce.date()])
	.transform((v) => parseFreeTalkCompletionDateInput(v instanceof Date ? v : v));

const listField = z
	.union([z.string(), z.array(z.coerce.string()), z.null()])
	.optional()
	.transform((v) => normalizeFreeTalkScenarioStringList(v));

const assignmentFields = {
	allLearners: z.boolean().optional().default(true),
	assignedLearnerIds: z
		.array(z.string())
		.optional()
		.default([])
		.transform((ids) => normalizeAssignedLearnerIds(ids)),
};

function refineAssignment(
	data: { allLearners: boolean; assignedLearnerIds: Array<Types.ObjectId | string> },
	ctx: z.RefinementCtx,
) {
	if (!data.allLearners && data.assignedLearnerIds.length === 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Select at least one learner, or choose Everyone',
			path: ['assignedLearnerIds'],
		});
	}
}

export const freeTalkScenarioBodySchema = z
	.object({
		title: z.string().min(1, 'Title is required').max(200),
		background: z.string().min(1, 'Background is required'),
		task: z.string().min(1, 'Task is required'),
		include: listField,
		usefulPhrases: listField,
		scenarioType: z.enum([...FREE_TALK_SCENARIO_TYPES] as [string, ...string[]]),
		hint: z.string().default(''),
		completionDate: completionDateField,
		...assignmentFields,
	})
	.superRefine(refineAssignment);

export const freeTalkScenarioPatchSchema = z
	.object({
		title: z.string().min(1).max(200).optional(),
		background: z.string().min(1).optional(),
		task: z.string().min(1).optional(),
		include: listField.optional(),
		usefulPhrases: listField.optional(),
		scenarioType: z.enum([...FREE_TALK_SCENARIO_TYPES] as [string, ...string[]]).optional(),
		hint: z.string().optional(),
		completionDate: completionDateField.optional(),
		allLearners: z.boolean().optional(),
		assignedLearnerIds: z
			.array(z.string())
			.optional()
			.transform((ids) => (ids === undefined ? undefined : normalizeAssignedLearnerIds(ids))),
	})
	.superRefine((data, ctx) => {
		if (data.allLearners === false && data.assignedLearnerIds?.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Select at least one learner, or choose Everyone',
				path: ['assignedLearnerIds'],
			});
		}
	});

export function serializeFreeTalkScenario(doc: Record<string, unknown>) {
	const assigned = (doc.assignedLearnerIds as Array<Types.ObjectId | string> | undefined) ?? [];
	const forEveryone = doc.allLearners !== false;
	const completionDate = doc.completionDate as Date | undefined;
	return {
		...doc,
		include: normalizeFreeTalkScenarioStringList(doc.include),
		usefulPhrases: normalizeFreeTalkScenarioStringList(doc.usefulPhrases),
		/** Explicit boolean: true = everyone, false = selected learners only */
		allLearners: forEveryone,
		assignedLearnerIds: forEveryone ? [] : assigned.map((id) => String(id)),
		completionDate: completionDate ? completionDate.toISOString() : null,
	};
}
