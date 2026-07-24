import { mission1Prompts } from './mission-1';
import { mission2Prompts } from './mission-2';
import { mission3Prompts } from './mission-3';
import { mission4Prompts } from './mission-4';
import { bonusScenarioPrompts } from './bonus-scenarios';

export const topicPrompts: Record<number, Record<string, {
	pronunciation: string;
	vocabulary: string;
	key_phrases: string;
	roleplay: string;
}>> = {
	1: mission1Prompts,
	2: mission2Prompts,
	3: mission3Prompts,
	4: mission4Prompts,
	5: bonusScenarioPrompts,
};
