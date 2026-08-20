import type { ChallengeDrillItem } from '@/domain/challenges/types';

export interface WeeklyChallengeMeta {
	challengeId: string;
	itemIndex: number;
	itemId: string;
	weekStartDate: string;
}

const DRILL_TYPE_TITLE: Record<string, string> = {
	pronunciation: 'Pronunciation',
	vocabulary: 'Vocabulary/Key Phrase',
	roleplay: 'Roleplay',
	key_phrases: 'Scenario/Pressure Test',
};

export function toDrillShape(
	item: ChallengeDrillItem,
	challengeId: string,
	index: number,
) {
	const title = DRILL_TYPE_TITLE[item.drillType] ?? item.targetWeakness.label;

	// vocabulary uses the MCQ fill-in-the-blank format (vocabulary_items),
	// which is structurally identical to fill_blank_items. Map to fill_blank
	// so the FillBlankDrill component handles it.
	if (item.drillType === 'vocabulary') {
		const content = item.generatedContent as any;
		return {
			_id: `${challengeId}-${index}`,
			type: 'fill_blank',
			title,
			difficulty: 'medium',
			...content,
			fill_blank_items: content.vocabulary_items ?? content.fill_blank_items ?? [],
		};
	}

	return {
		_id: `${challengeId}-${index}`,
		type: item.drillType,
		title,
		difficulty: 'medium',
		...item.generatedContent,
	};
}
