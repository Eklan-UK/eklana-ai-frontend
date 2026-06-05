import { utcMondayStartOfWeekContaining } from '@/lib/classes/utc-week';

export function isSundayUtc(now: Date = new Date()): boolean {
	return now.getUTCDay() === 0;
}

export function currentWeekStartUtc(now: Date = new Date()): Date {
	return utcMondayStartOfWeekContaining(now);
}
