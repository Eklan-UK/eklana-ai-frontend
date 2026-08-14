// Regenerates prompts.txt — a flat, human-readable snapshot of every topic prompt
// template (pronunciation/vocabulary/key_phrases/roleplay) across all mission and
// bonus files, for quick review without opening each source file.
// npx tsx src/scripts/dump-prompts.ts > prompts.txt

import { mission1Prompts } from '@/domain/challenges/topic-prompts/mission-1';
import { mission2Prompts } from '@/domain/challenges/topic-prompts/mission-2';
import { mission3Prompts } from '@/domain/challenges/topic-prompts/mission-3';
import { mission4Prompts } from '@/domain/challenges/topic-prompts/mission-4';
import { bonusScenarioPrompts } from '@/domain/challenges/topic-prompts/bonus-scenarios';

const SECTIONS = ['pronunciation', 'vocabulary', 'key_phrases', 'roleplay'] as const;

const groups: Array<{ label: string; prompts: Record<string, Record<string, string>> }> = [
	{ label: 'Mission 1', prompts: mission1Prompts },
	{ label: 'Mission 2', prompts: mission2Prompts },
	{ label: 'Mission 3', prompts: mission3Prompts },
	{ label: 'Mission 4', prompts: mission4Prompts },
	{ label: 'Bonus Scenarios', prompts: bonusScenarioPrompts },
];

const parts: string[] = [];
for (const { label, prompts } of groups) {
	for (const topic of Object.keys(prompts)) {
		for (const section of SECTIONS) {
			parts.push(`===== ${label} / ${topic} / ${section} =====\n${prompts[topic][section]}\n`);
		}
	}
}

process.stdout.write(parts.join('\n'));
