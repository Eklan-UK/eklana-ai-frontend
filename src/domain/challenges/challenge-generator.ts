import { generateConversationResponse } from '@/services/gemini.service';
import type { WeaknessProfile, WeeklyChallenge, ChallengeDrillItem } from './types';

const SYSTEM_INSTRUCTION =
	'You are Eklan, a clinical English fluency coach specialising in helping ' +
	'nurses and healthcare professionals communicate clearly and confidently. ' +
	'You generate precise, clinically relevant practice content.';

function buildPrompt(profile: WeaknessProfile): string {
	const weaknesses = profile.topWeaknesses.map((w) => ({
		drillType: w.drillType,
		category: w.category,
		severity: w.severity,
		evidence: w.evidence,
		label: w.label,
	}));

	return `
The learner has the following top weaknesses (up to 3), ranked by severity (1 = worst):

${JSON.stringify(weaknesses, null, 2)}

Generate one ChallengeDrillItem per weakness. Return a JSON object with this exact shape:

{
  "drillSequence": [
    {
      "drillType": "<must be one of: pronunciation, roleplay, vocabulary, matching, definition, summary, grammar, sentence_writing, sentence, listening, fill_blank, key_phrases>",
      "targetWeakness": {
        "drillType": "<string>",
        "category": "<pronunciation|fluency|vocabulary|grammar>",
        "severity": <number 0–1>,
        "evidence": ["<string>"],
        "label": "<string>"
      },
      "instructions": "<Gemini-generated instruction for this item>",
      "generatedContent": {}, // TODO: tighten generatedContent schema per drill type in a follow-up
      "estimatedMinutes": <number>
    }
  ],
  "totalEstimatedMinutes": <sum of estimatedMinutes>,
  "summaryMessage": "<short plain-English summary, e.g. 'This week focus on: fluency, phoneme /θ/, vocabulary'>"
}

The drillType field must exactly match one of the 12 types listed above. Do not invent new drill types.
Return ONLY valid JSON with this exact shape, no markdown, no preamble.
`.trim();
}

export async function generateWeeklyChallenge(
	profile: WeaknessProfile
): Promise<WeeklyChallenge['content']> {
	const responseText = await generateConversationResponse({
		systemInstruction: SYSTEM_INSTRUCTION,
		messages: [{ role: 'user', content: buildPrompt(profile) }],
		temperature: 0.7,
		maxTokens: 2000,
	});

	const match = responseText.match(/\{[\s\S]*\}/);
	if (!match) {
		throw new Error('Gemini response did not contain a JSON object');
	}

	const content = JSON.parse(match[0]) as {
		drillSequence: ChallengeDrillItem[];
		totalEstimatedMinutes: number;
		summaryMessage: string;
	};

	return content;
}
