import { toUserIdCandidates } from '@/lib/api/user-id';
import { NotFoundError, ValidationError } from '@/lib/api/response';
import Drill from '@/models/drill';
import DrillAssignment from '@/models/drill-assignment';
import type {
	PrecisionClinicLearnerWeekDetailResponse,
	PrecisionClinicLearnerWeekDrillListItem,
	PrecisionClinicLearnerWeekHistoryResponse,
	PrecisionClinicLearnerWeekListItem,
} from './types';

function defaultWeekTitle(weekNumber: number): string {
	return `Week ${weekNumber}`;
}

function weekNumberOf(assignment: {
	builderWeekNumber?: number | null;
}): number {
	const n = assignment.builderWeekNumber;
	return typeof n === 'number' && Number.isFinite(n) && n >= 1
		? Math.floor(n)
		: 1;
}

function assignedAtOf(assignment: {
	assignedAt?: Date | null;
	createdAt?: Date;
}): Date {
	return assignment.assignedAt ?? assignment.createdAt ?? new Date();
}

type PopulatedDrill = {
	_id: { toString(): string };
	title?: string;
	type?: string;
	difficulty?: string;
};

type LeanAssignment = {
	_id: { toString(): string };
	drillId: PopulatedDrill | null;
	builderWeekNumber?: number | null;
	assignedAt?: Date | null;
	createdAt?: Date;
	status?: string;
	completedAt?: Date | null;
};

function isPopulatedDrill(
	drillId: LeanAssignment['drillId']
): drillId is PopulatedDrill {
	return (
		drillId != null &&
		typeof drillId === 'object' &&
		'_id' in drillId
	);
}

/**
 * Learner-facing Precision Clinic weeks, computed live from
 * `DrillAssignment` + populated `Drill` where `source: 'precision_clinic'`,
 * bucketed by `builderWeekNumber`. Shared by web and mobile clients.
 *
 * Completion comes from real assignment `status` / `completedAt`.
 */
export class PrecisionClinicLearnerService {
	async getHistory(
		learnerId: string
	): Promise<PrecisionClinicLearnerWeekHistoryResponse> {
		const candidates = toUserIdCandidates(learnerId);
		const assignments = (await DrillAssignment.find({
			learnerId: { $in: candidates },
			source: 'precision_clinic',
		})
			.select('builderWeekNumber assignedAt createdAt status')
			.lean()
			.exec()) as LeanAssignment[];

		const byWeek = new Map<
			number,
			{ count: number; completed: number; assignedAt: Date }
		>();
		for (const assignment of assignments) {
			const weekNumber = weekNumberOf(assignment);
			const assignedAt = assignedAtOf(assignment);
			const isCompleted = assignment.status === 'completed';
			const existing = byWeek.get(weekNumber);
			if (existing) {
				existing.count += 1;
				if (isCompleted) existing.completed += 1;
				if (assignedAt < existing.assignedAt) {
					existing.assignedAt = assignedAt;
				}
			} else {
				byWeek.set(weekNumber, {
					count: 1,
					completed: isCompleted ? 1 : 0,
					assignedAt,
				});
			}
		}

		const weeks: PrecisionClinicLearnerWeekListItem[] = Array.from(
			byWeek.entries()
		)
			.sort((a, b) => b[0] - a[0])
			.map(([weekNumber, info]) => ({
				learnerWeekId: String(weekNumber),
				personalWeekNumber: weekNumber,
				title: defaultWeekTitle(weekNumber),
				status: 'ready',
				totalItems: info.count,
				completedItems: info.completed,
				assignedAt: info.assignedAt.toISOString(),
			}));

		return { weeks };
	}

	async getWeekDetail(
		learnerId: string,
		weekNumber: number
	): Promise<PrecisionClinicLearnerWeekDetailResponse> {
		if (!Number.isInteger(weekNumber) || weekNumber < 1) {
			throw new ValidationError('Invalid week number');
		}

		const candidates = toUserIdCandidates(learnerId);
		const assignments = (await DrillAssignment.find({
			learnerId: { $in: candidates },
			source: 'precision_clinic',
			builderWeekNumber: weekNumber,
		})
			.populate({
				path: 'drillId',
				model: Drill,
				select: 'title type difficulty',
			})
			.sort({ assignedAt: 1, createdAt: 1 })
			.lean()
			.exec()) as LeanAssignment[];

		const valid = assignments.filter((a) => isPopulatedDrill(a.drillId));

		if (valid.length === 0) {
			throw new NotFoundError('Precision clinic week');
		}

		const completedItemIndexes: number[] = [];
		const drillItems: PrecisionClinicLearnerWeekDrillListItem[] = valid.map(
			(assignment, index) => {
				const drill = assignment.drillId as PopulatedDrill;
				const drillId = String(drill._id);
				const assignmentId = String(assignment._id);
				const completed = assignment.status === 'completed';
				if (completed) completedItemIndexes.push(index);

				return {
					index,
					itemId: assignmentId,
					sourceDrillId: drillId,
					drillId,
					assignmentId,
					title: drill.title ?? 'Untitled drill',
					type: drill.type ?? 'vocabulary',
					difficulty: drill.difficulty ?? 'beginner',
					completed,
					sortOrder: index,
				};
			}
		);

		const earliestAssignedAt = valid.reduce<Date>((min, a) => {
			const assignedAt = assignedAtOf(a);
			return assignedAt < min ? assignedAt : min;
		}, assignedAtOf(valid[0]));

		return {
			learnerWeekId: String(weekNumber),
			personalWeekNumber: weekNumber,
			title: defaultWeekTitle(weekNumber),
			status: 'ready',
			totalItems: drillItems.length,
			completedItemIndexes,
			assignedAt: earliestAssignedAt.toISOString(),
			drills: drillItems,
		};
	}
}
