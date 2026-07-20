import User from '@/models/user';
import Drill from '@/models/drill';
import { DiscoveryCall } from '@/models/discovery-call';
import { isUserSubscribed } from '@/lib/api/user-subscription';
import { getZeroPauseChallengePhase } from '@/domain/subscriptions/subscription.types';

export interface AdminDashboardStats {
	totalUsers: number;
	subscribedUsers: number;
	totalActiveLearners: number;
	totalDrills: number;
	zeroPauseChallengeTrialUsers: number;
	zeroPauseChallengePostTrialUsers: number;
	zeroPauseMaintainerUsers: number;
	newSignupsThisWeek: number;
	discoveryCallsToday: number;
	videosAwaitingReview: number;
}

function startOfToday(): Date {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	return date;
}

function endOfToday(): Date {
	const date = new Date();
	date.setHours(23, 59, 59, 999);
	return date;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
	const now = new Date();
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const todayStart = startOfToday();
	const todayEnd = endOfToday();

	const learnerBaseQuery = { role: 'user' as const };
	const activeLearnerQuery = { role: 'user' as const, isActive: { $ne: false } };

	const [
		totalUsers,
		totalActiveLearners,
		totalDrills,
		discoveryCallsToday,
		learnerSubscriptionRows,
	] = await Promise.all([
		User.countDocuments({}).exec(),
		User.countDocuments(activeLearnerQuery).exec(),
		Drill.countDocuments({}).exec(),
		DiscoveryCall.countDocuments({
			status: 'Up coming',
			createdAt: { $gte: todayStart, $lte: todayEnd },
		}).exec(),
		User.find(learnerBaseQuery)
			.select(
				'subscriptionPlan subscriptionExpiresAt stripeSubscriptionStatus subscriptionPaymentMethod appleSubscriptionStatus appleOriginalTransactionId zeroPauseProducts zeroPauseDate zeroPauseEndDate createdAt'
			)
			.lean()
			.exec(),
	]);

	let subscribedUsers = 0;
	let zeroPauseChallengeTrialUsers = 0;
	let zeroPauseChallengePostTrialUsers = 0;
	let zeroPauseMaintainerUsers = 0;
	let newSignupsThisWeek = 0;

	for (const user of learnerSubscriptionRows) {
		if (isUserSubscribed(user)) subscribedUsers += 1;

		const products = user.zeroPauseProducts;
		if (Array.isArray(products)) {
			const challengePhase = getZeroPauseChallengePhase({
				zeroPauseProducts: products,
				zeroPauseEndDate: user.zeroPauseEndDate,
			});
			if (challengePhase === 'trial') zeroPauseChallengeTrialUsers += 1;
			if (challengePhase === 'post_trial') {
				zeroPauseChallengePostTrialUsers += 1;
			}
			if (products.includes('maintainer')) zeroPauseMaintainerUsers += 1;
		}

		if (user.createdAt && new Date(user.createdAt) >= oneWeekAgo) {
			newSignupsThisWeek += 1;
		}
	}

	return {
		totalUsers,
		subscribedUsers,
		totalActiveLearners,
		totalDrills,
		zeroPauseChallengeTrialUsers,
		zeroPauseChallengePostTrialUsers,
		zeroPauseMaintainerUsers,
		newSignupsThisWeek,
		discoveryCallsToday,
		videosAwaitingReview: 0,
	};
}
