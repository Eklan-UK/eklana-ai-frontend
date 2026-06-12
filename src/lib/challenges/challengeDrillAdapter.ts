import type { ChallengeDrillItem } from '@/domain/challenges/types';

export interface WeeklyChallengeMeta {
	challengeId: string;
	itemIndex: number;
	weekStartDate: string;
}

export function toDrillShape(
	item: ChallengeDrillItem,
	challengeId: string,
	index: number,
) {
	return {
		_id: `${challengeId}-${index}`,
		type: item.drillType,
		title: item.targetWeakness.label,
		difficulty: 'medium',
		...item.generatedContent,
	};
}
