import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import { NotFoundError, ValidationError } from '@/lib/api/response';
import { isValidUserId, toUserIdQuery } from '@/lib/api/user-id';
import User from '@/models/user';
import { PrecisionClinicRepository } from './precision-clinic.repository';
import type {
	CreatePrecisionClinicDrillData,
	UpdatePrecisionClinicDrillData,
	PrecisionClinicDrill,
	PrecisionClinicListFilters,
	PrecisionClinicListResult,
} from './types';

function normalizeLearnerIds(ids: string[] | undefined): string[] {
	if (!ids || ids.length === 0) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of ids) {
		if (typeof id !== 'string' || !isValidUserId(id)) {
			throw new ValidationError(`Invalid learner id: ${String(id)}`);
		}
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

function toStoredLearnerIds(
	ids: string[]
): Array<Types.ObjectId | string> {
	return ids.map((id) => toUserIdQuery(id));
}

/**
 * Domain service for Precision Clinic drills.
 */
export class PrecisionClinicService {
	constructor(private readonly repo: PrecisionClinicRepository) {}

	async list(
		filters: PrecisionClinicListFilters
	): Promise<PrecisionClinicListResult> {
		const limit = filters.limit ?? 20;
		const offset = filters.offset ?? 0;

		const [drills, total, stats] = await Promise.all([
			this.repo.findMany({ ...filters, limit, offset }),
			this.repo.countMany(filters),
			this.repo.getStats({
				includeArchived: filters.includeArchived,
				isArchived: filters.isArchived,
			}),
		]);

		return { drills, total, limit, offset, stats };
	}

	async getById(id: string): Promise<PrecisionClinicDrill> {
		if (!Types.ObjectId.isValid(id)) {
			throw new ValidationError('Invalid precision clinic drill id');
		}
		const drill = await this.repo.findById(id);
		if (!drill) {
			throw new NotFoundError('Precision clinic drill');
		}
		return drill;
	}

	async create(
		data: CreatePrecisionClinicDrillData,
		creator: { userId: string; email?: string }
	): Promise<PrecisionClinicDrill> {
		const assignedLearnerIds = normalizeLearnerIds(
			(data.assignedLearnerIds ?? []).map((id) => String(id))
		);

		if (assignedLearnerIds.length > 0) {
			await this.assertLearnersExist(assignedLearnerIds);
		}

		const payload: CreatePrecisionClinicDrillData = {
			...data,
			title: (data.title ?? '').trim() || 'Untitled Clinic Drill',
			difficulty: data.difficulty ?? 'intermediate',
			context: data.context ?? '',
			durationDays: data.durationDays ?? 1,
			preGenerateAudio: data.preGenerateAudio ?? false,
			assignedLearnerIds: toStoredLearnerIds(assignedLearnerIds),
			createdBy: toUserIdQuery(creator.userId),
			createdByEmail: creator.email ?? data.createdByEmail ?? '',
			isArchived: false,
			completionDate: data.completionDate
				? new Date(data.completionDate)
				: null,
		};

		const drill = await this.repo.create(payload);
		logger.info('Precision clinic drill created', {
			id: String(drill._id),
			type: drill.type,
		});
		return drill;
	}

	async update(
		id: string,
		data: UpdatePrecisionClinicDrillData
	): Promise<PrecisionClinicDrill> {
		if (!Types.ObjectId.isValid(id)) {
			throw new ValidationError('Invalid precision clinic drill id');
		}

		const existing = await this.repo.findById(id);
		if (!existing) {
			throw new NotFoundError('Precision clinic drill');
		}

		const update: UpdatePrecisionClinicDrillData = { ...data };
		delete (update as { createdBy?: unknown }).createdBy;
		delete (update as { createdByEmail?: unknown }).createdByEmail;

		if (data.assignedLearnerIds !== undefined) {
			const ids = normalizeLearnerIds(
				data.assignedLearnerIds.map((id) => String(id))
			);
			if (ids.length > 0) {
				await this.assertLearnersExist(ids);
			}
			update.assignedLearnerIds = toStoredLearnerIds(ids);
		}

		if (data.completionDate !== undefined) {
			update.completionDate = data.completionDate
				? new Date(data.completionDate)
				: null;
		}

		const updated = await this.repo.update(id, update);
		if (!updated) {
			throw new NotFoundError('Precision clinic drill');
		}
		return updated;
	}

	async delete(id: string): Promise<void> {
		if (!Types.ObjectId.isValid(id)) {
			throw new ValidationError('Invalid precision clinic drill id');
		}
		const existing = await this.repo.findById(id);
		if (!existing) {
			throw new NotFoundError('Precision clinic drill');
		}
		await this.repo.delete(id);
	}

	/**
	 * Merge learner ids into assignedLearnerIds (union).
	 */
	async assign(
		id: string,
		userIds: string[]
	): Promise<PrecisionClinicDrill> {
		if (!Types.ObjectId.isValid(id)) {
			throw new ValidationError('Invalid precision clinic drill id');
		}
		const ids = normalizeLearnerIds(userIds);
		if (ids.length === 0) {
			throw new ValidationError('userIds (non-empty array) is required');
		}
		await this.assertLearnersExist(ids);

		const existing = await this.repo.findById(id);
		if (!existing) {
			throw new NotFoundError('Precision clinic drill');
		}

		const current = new Set(
			(existing.assignedLearnerIds ?? []).map((x) => String(x))
		);
		for (const idStr of ids) {
			current.add(idStr);
		}
		const merged = Array.from(current);

		const updated = await this.repo.update(id, {
			assignedLearnerIds: toStoredLearnerIds(merged),
		});
		if (!updated) {
			throw new NotFoundError('Precision clinic drill');
		}
		return updated;
	}

	async duplicate(
		id: string,
		creator: { userId: string; email?: string }
	): Promise<PrecisionClinicDrill> {
		const source = await this.getById(id);
		const title = source.title.endsWith('(Copy)')
			? source.title
			: `${source.title} (Copy)`;

		return this.create(
			{
				title,
				type: source.type,
				difficulty: source.difficulty,
				context: source.context,
				completionDate: source.completionDate,
				durationDays: source.durationDays,
				preGenerateAudio: source.preGenerateAudio,
				ttsVoiceKey: source.ttsVoiceKey,
				assignedLearnerIds: [],
				soundGroups: source.soundGroups,
				questions: source.questions,
				pairs: source.pairs,
				patterns: source.patterns,
				words: source.words,
				contentTitle: source.contentTitle,
				content: source.content,
				articleTitle: source.articleTitle,
				articleContent: source.articleContent,
			},
			creator
		);
	}

	async archive(id: string): Promise<PrecisionClinicDrill> {
		if (!Types.ObjectId.isValid(id)) {
			throw new ValidationError('Invalid precision clinic drill id');
		}
		const existing = await this.repo.findById(id);
		if (!existing) {
			throw new NotFoundError('Precision clinic drill');
		}
		const updated = await this.repo.update(id, { isArchived: true });
		if (!updated) {
			throw new NotFoundError('Precision clinic drill');
		}
		return updated;
	}

	private async assertLearnersExist(userIds: string[]): Promise<void> {
		const learners = await User.find({
			_id: { $in: userIds.map((id) => toUserIdQuery(id)) },
			role: 'user',
		})
			.select('_id')
			.lean()
			.exec();

		const valid = new Set(learners.map((u) => String(u._id)));
		const invalid = userIds.filter((id) => !valid.has(id));
		if (invalid.length > 0) {
			throw new ValidationError(
				`The following userIds are not valid learners: ${invalid.join(', ')}`
			);
		}
	}
}
