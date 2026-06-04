import { Types } from 'mongoose';
import { logger } from '@/lib/api/logger';
import { ChallengeRepository } from './challenge.repository';
import { aggregateWeaknesses } from './weakness-aggregator';
import { generateWeeklyChallenge } from './challenge-generator';
import type { IWeeklyChallenge } from '@/models/weekly-challenge';
import type { WeeklyChallenge } from './types';

export class ChallengeService {
	constructor(private challengeRepo: ChallengeRepository) {}

	async getOrGenerateChallenge(
		learnerId: Types.ObjectId,
		weekStartDate: Date
	): Promise<IWeeklyChallenge> {
		// 1. Return cached challenge if already generated
		const existing = await this.challengeRepo.findByLearnerAndWeek(learnerId, weekStartDate);
		if (existing && existing.status === 'ready') {
			return existing;
		}

		// 2. Claim the slot — upsert as 'generating' so concurrent requests don't double-generate
		const doc = await this.challengeRepo.upsert({
			learnerId,
			weekStartDate,
			weaknessProfile: (existing?.weaknessProfile ?? null) as any,
			challengeType: 'structured_drill_sequence',
			content: (existing?.content ?? null) as any,
			status: 'generating',
		});

		try {
			// 3. Aggregate weaknesses for the 7-day window
			const profile = await aggregateWeaknesses(learnerId, weekStartDate);

			// 4. Nothing to challenge — save an empty ready document and return
			if (profile.topWeaknesses.length === 0) {
				const emptyContent: WeeklyChallenge['content'] = {
					drillSequence: [],
					totalEstimatedMinutes: 0,
					summaryMessage: 'No weaknesses detected this week.',
				};
				return await this.challengeRepo.upsert({
					learnerId,
					weekStartDate,
					weaknessProfile: profile,
					challengeType: 'structured_drill_sequence',
					content: emptyContent,
					status: 'ready',
					generatedAt: new Date(),
				});
			}

			// 5. Generate drill content from the weakness profile
			const content = await generateWeeklyChallenge(profile);

			// 6. Persist the completed challenge
			const saved = await this.challengeRepo.upsert({
				learnerId,
				weekStartDate,
				weaknessProfile: profile,
				challengeType: 'structured_drill_sequence',
				content,
				status: 'ready',
				generatedAt: new Date(),
			});

			logger.info('Weekly challenge generated', {
				learnerId: learnerId.toString(),
				weekStartDate,
				drillCount: content.drillSequence.length,
				totalMinutes: content.totalEstimatedMinutes,
			});

			return saved;
		} catch (error: any) {
			logger.error('Failed to generate weekly challenge', {
				learnerId: learnerId.toString(),
				weekStartDate,
				error: error.message,
			});
			await this.challengeRepo.updateStatus(doc._id as Types.ObjectId, 'failed');
			throw error;
		}
	}
}
