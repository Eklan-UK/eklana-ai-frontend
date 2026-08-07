import PrecisionClinicDrill from '@/models/precision-clinic-drill';
import { logger } from '@/lib/api/logger';
import type {
	PrecisionClinicDrill as ClinicDrill,
	CreatePrecisionClinicDrillData,
	UpdatePrecisionClinicDrillData,
	PrecisionClinicListFilters,
	PrecisionClinicStats,
} from './types';

/**
 * Build Mongo query for clinic list/count.
 */
export function buildClinicListQuery(
	filters: PrecisionClinicListFilters
): Record<string, unknown> {
	const query: Record<string, unknown> = {};

	if (filters.isArchived !== undefined) {
		query.isArchived = filters.isArchived;
	} else if (!filters.includeArchived) {
		query.isArchived = { $ne: true };
	}

	if (filters.type) query.type = filters.type;
	if (filters.difficulty) query.difficulty = filters.difficulty;

	if (filters.status === 'published') {
		query.$expr = {
			$gt: [{ $size: { $ifNull: ['$assignedLearnerIds', []] } }, 0],
		};
	} else if (filters.status === 'draft') {
		query.$expr = {
			$eq: [{ $size: { $ifNull: ['$assignedLearnerIds', []] } }, 0],
		};
	}

	if (filters.q) {
		const regex = new RegExp(
			filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
			'i'
		);
		const andClause = (query.$and as unknown[] | undefined) ?? [];
		query.$and = [
			...andClause,
			{ $or: [{ title: regex }, { context: regex }] },
		];
	}

	return query;
}

/** Count practice items on a single clinic drill by type. */
export function countClinicPracticeItems(drill: {
	type?: string;
	soundGroups?: unknown[];
	questions?: unknown[];
	pairs?: unknown[];
	patterns?: unknown[];
	words?: unknown[];
	contentTitle?: string;
	content?: string;
	articleTitle?: string;
	articleContent?: string;
}): number {
	const type = String(drill.type ?? '');
	const len = (arr: unknown[] | undefined) =>
		Array.isArray(arr) ? arr.length : 0;

	switch (type) {
		case 'pronunciation': {
			const groups = drill.soundGroups ?? [];
			if (!Array.isArray(groups)) return 0;
			return groups.reduce<number>((sum, g) => {
				const words =
					g && typeof g === 'object' && 'words' in g
						? (g as { words?: unknown[] }).words
						: undefined;
				return sum + (Array.isArray(words) ? words.length : 0);
			}, 0);
		}
		case 'key_phrases':
			return len(drill.questions);
		case 'matching':
			return len(drill.pairs);
		case 'grammar':
			return len(drill.patterns);
		case 'sentence_writing':
			return len(drill.words);
		case 'listening':
			return drill.content || drill.contentTitle ? 1 : 0;
		case 'summary':
			return drill.articleContent || drill.articleTitle ? 1 : 0;
		default:
			return 0;
	}
}

/**
 * Repository for Precision Clinic drill data access.
 */
export class PrecisionClinicRepository {
	async findById(id: string): Promise<ClinicDrill | null> {
		try {
			return (await PrecisionClinicDrill.findById(id)
				.lean()
				.exec()) as ClinicDrill | null;
		} catch (error: any) {
			logger.error('Error finding precision clinic drill by ID', {
				id,
				error: error.message,
			});
			throw error;
		}
	}

	async findByIdOrThrow(id: string): Promise<ClinicDrill> {
		const drill = await this.findById(id);
		if (!drill) {
			throw new Error(`Precision clinic drill with ID ${id} not found`);
		}
		return drill;
	}

	async findMany(filters: PrecisionClinicListFilters): Promise<ClinicDrill[]> {
		const query = buildClinicListQuery(filters);
		const queryBuilder = PrecisionClinicDrill.find(query).sort({
			createdAt: -1,
		});

		if (filters.limit) queryBuilder.limit(filters.limit);
		if (filters.offset) queryBuilder.skip(filters.offset);

		return (await queryBuilder.lean().exec()) as ClinicDrill[];
	}

	async countMany(filters: PrecisionClinicListFilters): Promise<number> {
		return PrecisionClinicDrill.countDocuments(
			buildClinicListQuery(filters)
		).exec();
	}

	async create(data: CreatePrecisionClinicDrillData): Promise<ClinicDrill> {
		try {
			const doc = await PrecisionClinicDrill.create(data);
			return doc.toObject() as ClinicDrill;
		} catch (error: any) {
			logger.error('Error creating precision clinic drill', {
				error: error.message,
			});
			throw error;
		}
	}

	async update(
		id: string,
		data: UpdatePrecisionClinicDrillData
	): Promise<ClinicDrill | null> {
		try {
			return (await PrecisionClinicDrill.findByIdAndUpdate(id, data, {
				new: true,
			})
				.lean()
				.exec()) as ClinicDrill | null;
		} catch (error: any) {
			logger.error('Error updating precision clinic drill', {
				id,
				error: error.message,
			});
			throw error;
		}
	}

	async delete(id: string): Promise<boolean> {
		try {
			const result = await PrecisionClinicDrill.findByIdAndDelete(id).exec();
			return !!result;
		} catch (error: any) {
			logger.error('Error deleting precision clinic drill', {
				id,
				error: error.message,
			});
			throw error;
		}
	}

	/**
	 * Aggregate list-page stats over non-archived drills (unless includeArchived).
	 */
	async getStats(
		baseFilters: Pick<
			PrecisionClinicListFilters,
			'includeArchived' | 'isArchived'
		> = {}
	): Promise<PrecisionClinicStats> {
		const match = buildClinicListQuery({
			includeArchived: baseFilters.includeArchived,
			isArchived: baseFilters.isArchived,
		});

		const docs = (await PrecisionClinicDrill.find(match)
			.select(
				'type assignedLearnerIds soundGroups questions pairs patterns words contentTitle content articleTitle articleContent'
			)
			.lean()
			.exec()) as Array<{
			type?: string;
			assignedLearnerIds?: unknown[];
			soundGroups?: unknown[];
			questions?: unknown[];
			pairs?: unknown[];
			patterns?: unknown[];
			words?: unknown[];
			contentTitle?: string;
			content?: string;
			articleTitle?: string;
			articleContent?: string;
		}>;

		let practiceItems = 0;
		let published = 0;
		for (const doc of docs) {
			practiceItems += countClinicPracticeItems(doc);
			if (
				Array.isArray(doc.assignedLearnerIds) &&
				doc.assignedLearnerIds.length > 0
			) {
				published += 1;
			}
		}

		return {
			total: docs.length,
			practiceItems,
			published,
			assigned: published,
		};
	}
}
