// POST /api/v1/precision-clinic/ai-generate
// Clinic-scoped AI generate (7 types only; no learning-journey required).
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { parseRequestBody } from '@/lib/api/request-parser';
import { validateRequest } from '@/lib/api/validation';
import { apiResponse } from '@/lib/api/response';
import { logger } from '@/lib/api/logger';
import { generateClinicDrillContent } from '@/domain/precision-clinic';
import { aiGeneratePrecisionClinicSchema } from '@/domain/precision-clinic/precision-clinic.validation';
import { aggregateWeaknesses } from '@/domain/challenges/weakness-aggregator';
import StudentContext from '@/models/studentContext';
import User from '@/models/user';
import { isValidUserId, toUserIdQuery } from '@/lib/api/user-id';

async function handler(
	req: NextRequest,
	_context: { userId: string; userRole: string }
) {
	const body = await parseRequestBody(req);
	const validated = validateRequest(aiGeneratePrecisionClinicSchema, body);

	const {
		drillTypes,
		difficulty,
		context: drillContext,
		prompt,
		title,
		students,
		studentIds,
		studentId,
	} = validated;

	logger.info('Generating Precision Clinic AI content', {
		drillTypes,
		difficulty,
		title,
	});

	// Prefer first student for enrichment (students | studentIds | studentId).
	const enrichmentId =
		(Array.isArray(students) && students[0]) ||
		(Array.isArray(studentIds) && studentIds[0]) ||
		studentId ||
		undefined;

	let studentContext: object | undefined;
	let drillWeaknesses: object[] | undefined;
	let studentName: string | undefined;

	if (enrichmentId && isValidUserId(enrichmentId)) {
		try {
			await connectToDatabase();
			const learnerQuery = toUserIdQuery(enrichmentId);

			const [contextDoc, user] = await Promise.all([
				StudentContext.findOne({ studentId: learnerQuery }).lean(),
				User.findById(learnerQuery).lean(),
			]);

			if (contextDoc) {
				studentContext = contextDoc as object;
			}

			if (user) {
				const fullName = [
					(user as { firstName?: string }).firstName,
					(user as { lastName?: string }).lastName,
				]
					.filter(Boolean)
					.join(' ')
					.trim();
				if (fullName) studentName = fullName;

				if (enrichmentId && Types.ObjectId.isValid(enrichmentId)) {
					const weekStartDate =
						(user as { subscriptionActivatedAt?: Date }).subscriptionActivatedAt ??
						new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
					const profile = await aggregateWeaknesses(
						new Types.ObjectId(enrichmentId),
						weekStartDate
					);
					if (profile.topWeaknesses.length > 0) {
						drillWeaknesses = profile.topWeaknesses;
					}
				}
			}
		} catch (enrichErr: any) {
			logger.warn('Failed to enrich clinic AI with student context', {
				enrichmentId,
				error: enrichErr.message,
			});
		}
	}

	const generated = await Promise.all(
		drillTypes.map(async (dt) => {
			const result = await generateClinicDrillContent({
				drillType: dt,
				difficulty: difficulty ?? 'intermediate',
				context: drillContext ?? '',
				prompt,
				studentContext,
				drillWeaknesses,
				studentName,
			});
			return {
				drillType: result.drillType,
				title: title ?? undefined,
				content: result.content,
			};
		})
	);

	return apiResponse.success(generated);
}

export const POST = withRole(
	['admin'],
	withErrorHandler(handler)
);
