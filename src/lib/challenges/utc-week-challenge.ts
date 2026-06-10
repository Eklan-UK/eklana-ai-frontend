import { utcMondayStartOfWeekContaining } from '@/lib/classes/utc-week';

export function isSundayUtc(now: Date = new Date(), subscriptionActivatedAt?: Date): boolean {
	if (!subscriptionActivatedAt) {
		return now.getUTCDay() === 0;
	}
	const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const activatedMs = Date.UTC(
		subscriptionActivatedAt.getUTCFullYear(),
		subscriptionActivatedAt.getUTCMonth(),
		subscriptionActivatedAt.getUTCDate(),
	);
	const daysDiff = Math.round((nowMs - activatedMs) / 86_400_000);
	return daysDiff >= 0 && daysDiff % 7 === 6;
}

export function currentWeekStartUtc(now: Date = new Date()): Date {
	return utcMondayStartOfWeekContaining(now);
}
