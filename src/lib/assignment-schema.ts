import { z } from 'zod';
import { Types } from 'mongoose';
import { normalizeAssignedLearnerIds } from '@/lib/free-talk-scenario-assignment';

export const assignmentFields = {
	allLearners: z.boolean().optional().default(true),
	assignedLearnerIds: z
		.array(z.string())
		.optional()
		.default([])
		.transform((ids) => normalizeAssignedLearnerIds(ids)),
};

export function refineAssignment(
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
