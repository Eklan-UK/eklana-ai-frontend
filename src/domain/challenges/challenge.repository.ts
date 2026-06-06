import { Types } from 'mongoose';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import type { IWeeklyChallenge } from '@/models/weekly-challenge';
import type { WeaknessProfile, WeeklyChallenge } from './types';
import { logger } from '@/lib/api/logger';

type UpsertData = {
	learnerId: Types.ObjectId;
	weekStartDate: Date;
	weaknessProfile: WeaknessProfile;
	challengeType: WeeklyChallenge['challengeType'];
	content: WeeklyChallenge['content'];
	status: IWeeklyChallenge['status'];
	generatedAt?: Date;
};

export class ChallengeRepository {
	async findByLearnerAndWeek(
		learnerId: Types.ObjectId,
		weekStartDate: Date
	): Promise<IWeeklyChallenge | null> {
		try {
			return await WeeklyChallengeModel.findOne({ learnerId, weekStartDate }).lean().exec();
		} catch (error: any) {
			logger.error('Error finding weekly challenge', {
				learnerId: learnerId.toString(),
				weekStartDate,
				error: error.message,
			});
			throw error;
		}
	}

	async upsert(data: UpsertData): Promise<IWeeklyChallenge> {
		const { learnerId, weekStartDate, ...fields } = data;
		try {
			const result = await WeeklyChallengeModel.findOneAndUpdate(
				{ learnerId, weekStartDate },
				{ $set: { learnerId, weekStartDate, ...fields } },
				{ upsert: true, returnDocument: 'after', lean: true }
			).exec();
			return result as IWeeklyChallenge;
		} catch (error: any) {
			logger.error('Error upserting weekly challenge', {
				learnerId: learnerId.toString(),
				weekStartDate,
				error: error.message,
			});
			throw error;
		}
	}

	async findAllByLearner(learnerId: Types.ObjectId): Promise<IWeeklyChallenge[]> {
		try {
			return await WeeklyChallengeModel.find({ learnerId })
				.sort({ weekStartDate: -1 })
				.lean()
				.exec();
		} catch (error: any) {
			logger.error('Error finding all weekly challenges for learner', {
				learnerId: learnerId.toString(),
				error: error.message,
			});
			throw error;
		}
	}

	async updateStatus(
		id: Types.ObjectId,
		status: IWeeklyChallenge['status'],
		generatedAt?: Date
	): Promise<IWeeklyChallenge | null> {
		const update: Record<string, unknown> = { status };
		if (generatedAt !== undefined) {
			update.generatedAt = generatedAt;
		}
		try {
			return await WeeklyChallengeModel.findByIdAndUpdate(
				id,
				{ $set: update },
				{ returnDocument: 'after', lean: true }
			).exec();
		} catch (error: any) {
			logger.error('Error updating weekly challenge status', {
				id: id.toString(),
				status,
				error: error.message,
			});
			throw error;
		}
	}
}
