import Profile from '@/models/profile';
import User from '@/models/user';
import WeeklyChallengeDispatch from '@/models/weekly-challenge-dispatch';
import { logger } from '@/lib/api/logger';
import { sendWeeklyChallengeReadyEmail } from '@/lib/api/email.service';
import { onWeeklyChallengeReady } from '@/services/notification/triggers';
import { encodeWeekStartDate } from '@/lib/challenges/weekly-challenge-url';
import type { IWeeklyChallenge } from '@/models/weekly-challenge';
import type { ChallengeDrillItem } from './types';

const DRILL_TYPE_LABELS: Record<string, string> = {
	pronunciation: 'Pronunciation',
	vocabulary: 'Vocabulary/Key Phrase',
	roleplay: 'Roleplay',
	key_phrases: 'Pressure Test',
	fill_blank: 'Fill in the Blank',
};

function formatDrillTypeLabel(drillType: string): string {
	return (
		DRILL_TYPE_LABELS[drillType] ??
		drillType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

function formatWeekLabel(weekStartDate: Date): string {
	return weekStartDate.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC',
	});
}

export type WeeklyChallengeNotifyResult = {
	status: 'sent' | 'skipped';
	reason?: string;
	channels?: { email: boolean; push: boolean };
};

export class WeeklyChallengeNotificationService {
	async notifyIfReady(params: {
		learnerId: string;
		weekStartDate: Date;
		challengeId: string;
		drillSequence: ChallengeDrillItem[];
		summaryMessage?: string;
	}): Promise<WeeklyChallengeNotifyResult> {
		const { learnerId, weekStartDate, challengeId, drillSequence } = params;

		if (drillSequence.length === 0) {
			return { status: 'skipped', reason: 'no_drills' };
		}

		const alreadySent = await WeeklyChallengeDispatch.findOne({
			learnerId,
			weekStartDate,
		}).lean();
		if (alreadySent) {
			return { status: 'skipped', reason: 'already_dispatched' };
		}

		const profile = await Profile.findOne({ userId: learnerId })
			.select('notificationPreferences')
			.lean();
		if (profile?.notificationPreferences?.learningReminders === false) {
			return { status: 'skipped', reason: 'prefs_disabled' };
		}

		const learner = await User.findById(learnerId)
			.select('email firstName lastName name')
			.lean();

		const studentName =
			`${(learner as { firstName?: string })?.firstName ?? ''} ${(learner as { lastName?: string })?.lastName ?? ''}`.trim() ||
			(learner as { name?: string })?.name ||
			'Student';

		const drillCount = drillSequence.length;
		const drillTypes = drillSequence.map((d) => formatDrillTypeLabel(d.drillType));
		const weekLabel = formatWeekLabel(weekStartDate);
		const weekStartIso = weekStartDate.toISOString();
		const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
		const challengeUrl = `${appUrl}/account/practice/weekly-challenge/${encodeWeekStartDate(weekStartIso)}`;

		let emailSucceeded = false;
		let pushSucceeded = false;

		if (learner?.email) {
			try {
				await sendWeeklyChallengeReadyEmail({
					studentEmail: learner.email as string,
					studentName,
					drillCount,
					drillTypes,
					weekLabel,
					challengeUrl,
				});
				emailSucceeded = true;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.warn('Weekly challenge ready email failed', { learnerId, msg });
			}
		}

		try {
			const pushResult = await onWeeklyChallengeReady(learnerId, {
				drillCount,
				drillTypes,
				weekStartDate: weekStartIso,
			});
			if (pushResult) {
				pushSucceeded = true;
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn('Weekly challenge ready push failed', { learnerId, msg });
		}

		if (emailSucceeded || pushSucceeded) {
			try {
				await WeeklyChallengeDispatch.create({
					learnerId,
					weekStartDate,
					challengeId,
					drillCount,
					sentAt: new Date(),
					channels: { email: emailSucceeded, push: pushSucceeded },
				});
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				if (!msg.includes('duplicate key') && !msg.includes('E11000')) {
					logger.warn('WeeklyChallengeDispatch.create failed', { msg });
				}
			}

			return {
				status: 'sent',
				channels: { email: emailSucceeded, push: pushSucceeded },
			};
		}

		return { status: 'skipped', reason: 'delivery_failed' };
	}
}

const notificationService = new WeeklyChallengeNotificationService();

export async function notifyWeeklyChallengeReadyFromDoc(
	doc: IWeeklyChallenge,
): Promise<WeeklyChallengeNotifyResult> {
	return notificationService.notifyIfReady({
		learnerId: String(doc.learnerId),
		weekStartDate: doc.weekStartDate,
		challengeId: doc._id.toString(),
		drillSequence: doc.content?.drillSequence ?? [],
		summaryMessage: doc.content?.summaryMessage,
	});
}
