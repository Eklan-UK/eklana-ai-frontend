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

Generate one ChallengeDrillItem per weakness. For each item, choose drillType based on the weakness category:
- pronunciation weakness → "pronunciation" or "key_phrases"
- fluency weakness → "roleplay"
- vocabulary weakness → "fill_blank" or "key_phrases"
- grammar weakness → "fill_blank"

drillType must be one of: pronunciation, fill_blank, key_phrases, roleplay. Do not use any other drill type.

Return a JSON object with this exact shape:

{
  "drillSequence": [
    {
      "drillType": "<pronunciation | fill_blank | key_phrases | roleplay>",
      "targetWeakness": {
        "drillType": "<string>",
        "category": "<pronunciation|fluency|vocabulary|grammar>",
        "severity": <number 0–1>,
        "evidence": ["<string>"],
        "label": "<string>"
      },
      "instructions": "<instruction describing what the learner should focus on>",
      "generatedContent": <see per-type schema below>,
      "estimatedMinutes": <number>
    }
  ],
  "totalEstimatedMinutes": <sum of estimatedMinutes>,
  "summaryMessage": "<short plain-English summary, e.g. 'This week focus on: fluency, phoneme /θ/, vocabulary'>"
}

Per-type generatedContent schemas:

"pronunciation" → {
  "pronunciation_items": [
    { "word": "<single medical word>", "sentence": "<clinical sentence using the word>", "sound": "<IPA phoneme e.g. /θ/>" }
  ]
}

"fill_blank" → {
  "fill_blank_items": [
    {
      "sentence": "<sentence with ___ for each blank>",
      "blanks": [
        { "position": <0-based index>, "correctAnswer": "<word>", "options": ["<word>", "<word>", "<word>", "<word>"] }
      ]
    }
  ]
}
CONSTRAINT: sentence must contain exactly as many ___ as entries in blanks[].

"key_phrases" → {
  "key_phrase_items": [
    {
      "prompt": "<something a patient or colleague says>",
      "options": ["<response A>", "<response B>", "<response C>"],
      "correctAnswer": "<must exactly match one element of options[]>",
      "respondentName": "<optional speaker label e.g. 'Patient'>"
    }
  ]
}
CONSTRAINT: correctAnswer must be a string that exactly matches one element of options[].

"roleplay" → {
  "student_character_name": "<e.g. 'Nurse'>",
  "ai_character_names": ["<e.g. 'Patient'>"],
  "context": "<brief scenario description>",
  "roleplay_scenes": [
    {
      "scene_name": "<optional scene title>",
      "dialogue": [
        { "speaker": "<'student' or 'ai_0', 'ai_1' — never a character name>", "text": "<line>" }
      ]
    }
  ]
}
CONSTRAINT: speaker must be "student" or "ai_<n>" where n is a 0-based index into ai_character_names[]. Never use the character's name as the speaker value.

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
		maxTokens: 4000,
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
