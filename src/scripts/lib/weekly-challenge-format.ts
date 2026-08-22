// Shared formatting helpers for weekly-challenge terminal reports.
// Used by weekly-challenge-report-single.ts and test-topic-prompt.ts so both
// scripts render generated drill content identically.

export const DRILL_LABELS: Record<string, string> = {
	pronunciation: 'Pronunciation',
	vocabulary: 'Vocabulary',
	key_phrases: 'Scenario Pressure Test',
	roleplay: 'Roleplay',
	fill_blank: 'Fill in the Blank',
};

/**
 * Turns a drill's generatedContent into a list of pre-formatted, indented lines
 * ready to print. Vocabulary and key_phrases lines also include the 4 answer
 * options so distractor quality can be eyeballed.
 */
export function summariseContent(drillType: string, content: any): string[] {
	if (!content) return ['  (no content)'];

	switch (drillType) {
		case 'pronunciation': {
			const items: any[] = content.pronunciation_items ?? [];
			if (items.length === 0) return ['  (no items)'];
			return items.map((item, i) => `  ${i + 1}. "${item.word}" [${item.sound ?? '?'}] — ${item.sentence}`);
		}

		case 'vocabulary': {
			const items: any[] = content.vocabulary_items ?? content.target_sentences ?? [];
			if (items.length === 0) return ['  (no items)'];
			const lines: string[] = [];
			items.forEach((item, i) => {
				const sentence = item.sentence ?? item.text ?? '?';
				const blank = item.blanks?.[0];
				const answer = blank?.correctAnswer ?? item.word ?? '?';
				lines.push(`  ${i + 1}. ${sentence}  → answer: "${answer}"`);
				const options: string[] = blank?.options ?? item.options ?? [];
				if (options.length > 0) lines.push(`       options: ${options.join(' | ')}`);
			});
			return lines;
		}

		case 'key_phrases': {
			const items: any[] = content.key_phrase_items ?? [];
			if (items.length === 0) return ['  (no items)'];
			const lines: string[] = [];
			items.forEach((item, i) => {
				lines.push(
					`  ${i + 1}. [${item.respondentName ?? 'Speaker'}] ${item.prompt}  → correct: "${item.correctAnswer}"`
				);
				const options: string[] = item.options ?? [];
				if (options.length > 0) lines.push(`       options: ${options.join(' | ')}`);
			});
			return lines;
		}

		case 'roleplay': {
			const scenes: any[] = content.roleplay_scenes ?? [];
			if (scenes.length === 0) return ['  (no scenes)'];

			const studentName: string = content.student_character_name ?? 'Student';
			const aiNames: string[] = content.ai_character_names ?? [];

			const resolveSpeaker = (speaker: string): string => {
				if (speaker === 'student') return studentName;
				const match = speaker.match(/^ai_(\d+)$/);
				if (match) return aiNames[Number(match[1])] ?? speaker;
				return speaker;
			};

			const lines: string[] = [];
			scenes.forEach((scene, i) => {
				const title = scene.scene_name || scene.scene_title || `Scene ${i + 1}`;
				lines.push(`  SCENE ${i + 1}: ${title}`);
				const dialogue: any[] = scene.dialogue ?? [];
				if (dialogue.length === 0) {
					lines.push('    (no dialogue)');
				} else {
					for (const turn of dialogue) {
						const speakerName = resolveSpeaker(turn.speaker);
						lines.push(`    ${speakerName}: "${turn.text}"`);
					}
				}
			});
			return lines;
		}

		case 'fill_blank': {
			const items: any[] = content.fill_blank_items ?? [];
			if (items.length === 0) return ['  (no items)'];
			return items.map((item, i) => `  ${i + 1}. ${item.sentence}`);
		}

		default:
			return [`  (unknown drill type: ${drillType})`];
	}
}

/**
 * Formats a single drill (label header, instructions, content) into printable
 * lines. Returns the block without a trailing blank line so callers control
 * spacing.
 */
export function formatDrillBlock(drill: {
	drillType: string;
	instructions?: string;
	generatedContent: any;
}): string[] {
	const label = DRILL_LABELS[drill.drillType] ?? drill.drillType;
	const lines = [`  ${label.toUpperCase()}`];
	if (drill.instructions) lines.push(`  ${drill.instructions}`);
	lines.push(...summariseContent(drill.drillType, drill.generatedContent));
	return lines;
}
