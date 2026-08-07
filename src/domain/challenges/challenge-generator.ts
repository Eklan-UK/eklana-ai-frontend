import { z } from 'zod';
import { generateChallengeCompletion } from '@/services/openai.service';
import { topicPrompts } from './topic-prompts';
import type { WeaknessProfile, WeeklyChallenge, ChallengeDrillItem } from './types';

type TopicDrillType = 'pronunciation' | 'vocabulary' | 'key_phrases' | 'roleplay';

const INSTRUCTIONS_BY_TYPE: Record<TopicDrillType, string> = {
	pronunciation: 'Practice these words and phrases focusing on clear pronunciation.',
	vocabulary:
		'Focus on using these vocabularies correctly. Pay attention to the meaning and appropriate usage.',
	roleplay:
		'Improve your speaking and conversational skills in these difficult scenarios. Make your mistakes here, not during your shift.',
	key_phrases: 'Practice responding in these clinical situations using the correct key phrases.',
};

const drillItemSchema = z.object({
	drillType: z.string(),
	targetWeakness: z.object({
		drillType: z.string(),
		category: z.string(),
		severity: z.number(),
		evidence: z.array(z.string()),
		label: z.string(),
	}),
	instructions: z.string(),
	generatedContent: z.unknown(),
	estimatedMinutes: z.number(),
});

const vocabularyItemSchema = z.object({
	sentence: z.string(),
	blanks: z.array(z.object({
		position: z.number(),
		correctAnswer: z.string(),
		options: z.array(z.string()),
	})),
});

const contentSchema = z.object({
	drillSequence: z.array(drillItemSchema),
	totalEstimatedMinutes: z.number(),
	summaryMessage: z.string(),
});

const SYSTEM_INSTRUCTION =
	'You are Eklan, a clinical English fluency coach specialising in helping ' +
	'nurses and healthcare professionals communicate clearly and confidently. ' +
	'You generate precise, clinically relevant practice content.';

export interface ChallengeGenerationContext {
	country?: string;
}

function buildPrompt(profile: WeaknessProfile, context?: ChallengeGenerationContext): string {
	const weaknesses = profile.topWeaknesses.map((w) => ({
		drillType: w.drillType,
		category: w.category,
		severity: w.severity,
		evidence: w.evidence,
		label: w.label,
	}));

	let masteredNote = '';
	if (profile.masteredPhonemes && profile.masteredPhonemes.length > 0) {
		const masteredList = profile.masteredPhonemes.join(', ');
		masteredNote =
			weaknesses.length < 4
				? `\nThe learner's weaknesses list is thin, so also include some pronunciation content reinforcing these recently mastered phonemes to keep them sharp: ${masteredList}\n`
				: `\nDo NOT generate pronunciation content targeting these phonemes as the student has recently mastered them: ${masteredList}\n`;
	}

	const countryNote = context?.country
		? `\nThe learner practices nursing in ${context.country} — use clinical terminology, medication names, and healthcare-system conventions appropriate to that country.\n`
		: '';

	const studentName = profile.studentName;
	const studentRole = profile.studentRole;

	return `
The learner has the following top weaknesses (up to 4), ranked by severity (1 = worst):

${JSON.stringify(weaknesses, null, 2)}


IMPORTANT: The evidence[] field is the primary source for all weakness-specific content. Use the listed words, phrases, and phonemes directly when creating drills. Do not invent additional weaknesses or replace them with generic examples.
- For pronunciation: use the weak phonemes listed in evidence to select words that target those specific sounds
- For vocabulary: use the exact words listed in 'Struggled with:' from the evidence field
- For key_phrases: base the clinical scenarios on the student's actual drill context
- For roleplay: create scenarios that naturally incorporate the student's weak areas from evidence

IMPORTANT: The four drills must complement each other rather than repeat each other.
- pronunciation: target weak phonemes using words from the evidence field.
- vocabulary: teach the meaning and correct clinical usage of weak words from the evidence field.
- roleplay: build realistic clinical conversations that exercise the same underlying communication weaknesses without reusing the exact vocabulary items from the pronunciation or vocabulary drills.
- key_phrases: practise selecting the most appropriate professional response in realistic clinical situations.

Distribute the student's weak areas across the four drills so each focuses on a different aspect of the learner's performance.

Generate exactly four ChallengeDrillItems:
1. pronunciation
2. vocabulary
3. roleplay
4. key_phrases

Each drillType must be unique and exactly match one of the four values above.

Use these exact instructions per drill type:
- pronunciation: "Practice these words and phrases focusing on clear pronunciation."
- vocabulary: "Focus on using these vocabularies correctly. Pay attention to the meaning and appropriate usage."
- roleplay: "Improve your speaking and conversational skills in these difficult scenarios. Make your mistakes here, not during your shift."
- key_phrases: "Practice responding in these clinical situations using the correct key phrases."
${masteredNote}${countryNote}
Return a JSON object with this exact shape:

{
  "drillSequence": [
    {
      "drillType": "<pronunciation | vocabulary | key_phrases | roleplay>",
      "targetWeakness": {
        "drillType": "<string>",
        "category": "<pronunciation|fluency|vocabulary|grammar>",
        "severity": <number 0–1>,
        "evidence": ["<string>"],
        "label": "<string>"
      },
      "instructions": "<use the exact instruction string for this drillType as specified above>",
      "generatedContent": <see per-type schema below>,
      "estimatedMinutes": <number>
    }
  ],
  "totalEstimatedMinutes": <sum of estimatedMinutes>,
  "summaryMessage": "Personalized to address your weakest areas"
}

Per-type generatedContent schemas:

"pronunciation" → {
  "pronunciation_items": [
    { "word": "<single medical word>", "sentence": "<clinical sentence using the word>", "sound": "<IPA phoneme e.g. /θ/>" }
  ]
}
CONSTRAINT: pronunciation_items must contain 15–20 items. Each item needs word, sound, and sentence.

"vocabulary" → {
  "vocabulary_items": [
    {
      "context": "<short situational setup before the sentence, e.g. 'You are handing over to the night nurse, so you say:'>",
      "sentence": "<clinical sentence with ___ placeholder>",
      "blanks": [
        {
          "position": 0,
          "correctAnswer": "<word the student actually struggled with>",
          "options": ["<A>", "<B>", "<C>", "<D>"]
        }
      ]
    }
  ]
}
CONSTRAINT: vocabulary_items must contain 15-20 items.
CONSTRAINT: Use words/phrases from the student's evidence field.
CONSTRAINT: Do not repeat the same correct answer across multiple questions. Each vocabulary_item must test a DIFFERENT word.
CONSTRAINT: If the student's evidence contains only a few weak words, supplement with other relevant vocabulary that a nurse at this level should know — words related to patient assessment, medication, handover, and clinical procedures. The weak words from evidence should appear first, but the remaining items should introduce varied clinical vocabulary, not repeat the same words.
CONSTRAINT: correctAnswer must exactly match one of the options.
CONSTRAINT: If any question references the student by name or professional role, use only the real values: '${studentName}' and '${studentRole}'. Do not invent a different name or role for the student.

"key_phrases" → {
  "key_phrase_items": [
    {
      "prompt": "<what an incoming nurse, patient, or doctor says>",
      "options": ["<response A>", "<response B>", "<response C>", "<response D>"],
      "correctAnswer": "<must exactly match one element of options[]>",
      "respondentName": "<e.g. 'Incoming Nurse', 'Patient', 'Doctor'>"
    }
  ]
}
CONSTRAINT: key_phrase_items must contain 15–20 items.
CONSTRAINT: correctAnswer must be a string that exactly matches one element of options[].
CONSTRAINT: This is a professional nursing exam. ALL 4 options must be things a qualified nurse might genuinely say in that situation. Options like 'Hey, what's up?', 'See ya later', 'How's it going?' are unacceptable — they are too casual for a clinical setting. Wrong answers must be professional but subtly incorrect — for example, using the wrong clinical term, giving information in the wrong order, or being technically accurate but inappropriate for the situation. A senior nurse reviewing the options should not be able to immediately eliminate 3 of the 4 as obviously wrong.
CONSTRAINT: If any question references the student by name or professional role, use only the real values: '${studentName}' and '${studentRole}'. Do not invent a different name or role for the student.

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
CONSTRAINT: ai_character_names must use real, concrete names that match the characters' roles in the scenario. Never use placeholders like [Name] or [Nurse Name].
CONSTRAINT: If you assign a name to the student character, it must be exactly '${studentName}'. Do not invent a different name for the student. If you assign a professional role or title to the student character, it must be '${studentRole}'. You are not required to name the student character, but if you do, use only the real name and role provided.

Examples:
- Nurse handover scenario → ai_character_names: ['Nurse Sarah Chen']
- Doctor escalation → ai_character_names: ['Dr. James']
- Patient interaction → ai_character_names: ['Mr. David Thompson']
- Multi-character → ai_character_names: ['Nurse Sarah Chen', 'Dr. James']

The name must be culturally appropriate and feel like a real person. Never name a nurse character 'Patient' or a doctor character 'Nurse'.
CONSTRAINT: NEVER use placeholder text in any form. This includes [your name], [nurse name], [patient name], [colleague name], [doctor name], or any text in square brackets. All names must be concrete and fully written. The student character's name comes from student_character_name. AI character names come from ai_character_names[]. Every single dialogue line must be complete and ready to speak aloud with no blanks or placeholders of any kind. If you are tempted to write a placeholder, write an actual name instead. NEVER use underscores (___) or dashes (---) as placeholders in dialogue. Every word in every dialogue line must be a real word. The sentence "I recommend we ______ the dosage" is WRONG. The sentence "I recommend we increase the dosage" is CORRECT. Write complete, natural sentences only.

Return ONLY valid JSON with this exact shape, no markdown, no preamble.
`.trim();
}

/**
 * Looks up a hand-authored, mission/topic-specific prompt template for a given
 * drill type. Returns null when no mission/topic is known, when nothing has
 * been authored for that mission/topic/drillType combination, or when the
 * entry is still an unfilled `TODO` placeholder (see topic-prompts/mission-*.ts).
 */
export function getTopicPrompt(
	mission: number | null,
	topic: string | null,
	drillType: string
): string | null {
	if (mission == null && topic == null) return null;

	const raw =
		mission != null && topic != null
			? topicPrompts[mission]?.[topic]?.[drillType as TopicDrillType]
			: undefined;

	if (!raw || raw.trim().toUpperCase() === 'TODO') return null;
	return raw;
}

function extractEvidence(
	profile: WeaknessProfile,
	predicate: (w: WeaknessProfile['weaknesses'][number]) => boolean
): string {
	const evidence = profile.weaknesses.filter(predicate).flatMap((w) => w.evidence);
	const unique = [...new Set(evidence)];
	return unique.length > 0 ? unique.join('; ') : 'None recorded this week';
}

function extractEvidenceContaining(
	profile: WeaknessProfile,
	predicate: (w: WeaknessProfile['weaknesses'][number]) => boolean,
	keyword: string
): string {
	const evidence = profile.weaknesses
		.filter(predicate)
		.flatMap((w) => w.evidence)
		.filter((e) => e.toLowerCase().includes(keyword));
	const unique = [...new Set(evidence)];
	return unique.length > 0 ? unique.join('; ') : 'None recorded this week';
}

function substitutePlaceholders(
	template: string,
	profile: WeaknessProfile,
	context?: ChallengeGenerationContext
): string {
	const values: Record<string, string> = {
		country: context?.country ?? profile.country ?? 'the learner\'s home country',
		mission: profile.primaryMission != null ? `Mission ${profile.primaryMission}` : 'General practice',
		topic: profile.primaryTopic ?? 'General clinical communication',
		student_name: profile.studentName || 'the learner',
		student_role: profile.studentRole || 'nurse',
		weak_phonemes: extractEvidenceContaining(profile, (w) => w.category === 'pronunciation', 'phoneme'),
		weak_words: extractEvidenceContaining(profile, (w) => w.category === 'pronunciation', 'word'),
		missed_phrases: extractEvidence(profile, (w) => w.drillType === 'key_phrases'),
		weak_vocabulary: extractEvidence(profile, (w) => w.category === 'vocabulary'),
		fill_blank_evidence: extractEvidence(profile, (w) => w.drillType === 'fill_blank'),
		practiced_scenarios: extractEvidence(
			profile,
			(w) => w.drillType === 'roleplay' || w.drillType === 'free_talk'
		),
	};

	return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

const DRILL_TYPES: TopicDrillType[] = ['pronunciation', 'vocabulary', 'roleplay', 'key_phrases'];

/**
 * Canonical per-type generatedContent shape + constraints. Used two ways in
 * buildCombinedPrompt(): (1) as the fallback generation guidance for a drill
 * type when no topic-specific template exists, and (2) always, at the end of
 * the combined prompt, to pin down the REQUIRED output shape for that type —
 * since topic-specific templates describe their own (different) JSON shape
 * that the model must be told to ignore in favor of this one.
 */
function genericDrillTypeGuidance(
	drillType: TopicDrillType,
	studentName: string,
	studentRole: string
): string {
	switch (drillType) {
		case 'pronunciation':
			return `"pronunciation" → {
  "pronunciation_items": [
    { "word": "<single medical word>", "sentence": "<clinical sentence using the word>", "sound": "<IPA phoneme e.g. /θ/>" }
  ]
}
CONSTRAINT: pronunciation_items must contain 15–20 items. Each item needs word, sound, and sentence.`;
		case 'vocabulary':
			return `"vocabulary" → {
  "vocabulary_items": [
    {
      "context": "<short situational setup before the sentence, e.g. 'You are handing over to the night nurse, so you say:'>",
      "sentence": "<clinical sentence with ___ placeholder>",
      "blanks": [
        {
          "position": 0,
          "correctAnswer": "<word the student actually struggled with>",
          "options": ["<A>", "<B>", "<C>", "<D>"]
        }
      ]
    }
  ]
}
CONSTRAINT: vocabulary_items must contain 15-20 items.
CONSTRAINT: Use words/phrases from the student's evidence field.
CONSTRAINT: Do not repeat the same correct answer across multiple questions. Each vocabulary_item must test a DIFFERENT word.
CONSTRAINT: If the student's evidence contains only a few weak words, supplement with other relevant vocabulary that a nurse at this level should know — words related to patient assessment, medication, handover, and clinical procedures. The weak words from evidence should appear first, but the remaining items should introduce varied clinical vocabulary, not repeat the same words.
CONSTRAINT: correctAnswer must exactly match one of the options.
CONSTRAINT: If any question references the student by name or professional role, use only the real values: '${studentName}' and '${studentRole}'. Do not invent a different name or role for the student.`;
		case 'key_phrases':
			return `"key_phrases" → {
  "key_phrase_items": [
    {
      "prompt": "<what an incoming nurse, patient, or doctor says>",
      "options": ["<response A>", "<response B>", "<response C>", "<response D>"],
      "correctAnswer": "<must exactly match one element of options[]>",
      "respondentName": "<e.g. 'Incoming Nurse', 'Patient', 'Doctor'>"
    }
  ]
}
CONSTRAINT: key_phrase_items must contain 15–20 items.
CONSTRAINT: correctAnswer must be a string that exactly matches one element of options[].
CONSTRAINT: This is a professional nursing exam. ALL 4 options must be things a qualified nurse might genuinely say in that situation. Options like 'Hey, what's up?', 'See ya later', 'How's it going?' are unacceptable — they are too casual for a clinical setting. Wrong answers must be professional but subtly incorrect — for example, using the wrong clinical term, giving information in the wrong order, or being technically accurate but inappropriate for the situation. A senior nurse reviewing the options should not be able to immediately eliminate 3 of the 4 as obviously wrong.
CONSTRAINT: If any question references the student by name or professional role, use only the real values: '${studentName}' and '${studentRole}'. Do not invent a different name or role for the student.`;
		case 'roleplay':
			return `"roleplay" → {
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
CONSTRAINT: ai_character_names must use real, concrete names that match the characters' roles in the scenario. Never use placeholders like [Name] or [Nurse Name].
CONSTRAINT: If you assign a name to the student character, it must be exactly '${studentName}'. Do not invent a different name for the student. If you assign a professional role or title to the student character, it must be '${studentRole}'. You are not required to name the student character, but if you do, use only the real name and role provided.

Examples:
- Nurse handover scenario → ai_character_names: ['Nurse Sarah Chen']
- Doctor escalation → ai_character_names: ['Dr. James']
- Patient interaction → ai_character_names: ['Mr. David Thompson']
- Multi-character → ai_character_names: ['Nurse Sarah Chen', 'Dr. James']

The name must be culturally appropriate and feel like a real person. Never name a nurse character 'Patient' or a doctor character 'Nurse'.
CONSTRAINT: NEVER use placeholder text in any form. This includes [your name], [nurse name], [patient name], [colleague name], [doctor name], or any text in square brackets. All names must be concrete and fully written. The student character's name comes from student_character_name. AI character names come from ai_character_names[]. Every single dialogue line must be complete and ready to speak aloud with no blanks or placeholders of any kind. If you are tempted to write a placeholder, write an actual name instead. NEVER use underscores (___) or dashes (---) as placeholders in dialogue. Every word in every dialogue line must be a real word. The sentence "I recommend we ______ the dosage" is WRONG. The sentence "I recommend we increase the dosage" is CORRECT. Write complete, natural sentences only.`;
	}
}

/**
 * Builds ONE prompt requesting all 4 drill types in a single response.
 * For each drill type, uses the topic-specific template (with placeholders
 * substituted) when getTopicPrompt() returns one, otherwise falls back to
 * the generic per-type guidance. Every drill type's generatedContent must
 * still conform to the canonical shape pinned down at the end of the
 * prompt — topic-specific templates describe their own (incompatible) JSON
 * shape internally, so the model is explicitly told to ignore those format
 * instructions and follow only the unified schema below.
 */
function buildCombinedPrompt(profile: WeaknessProfile, context?: ChallengeGenerationContext): string {
	const weaknesses = profile.topWeaknesses.map((w) => ({
		drillType: w.drillType,
		category: w.category,
		severity: w.severity,
		evidence: w.evidence,
		label: w.label,
	}));

	let masteredNote = '';
	if (profile.masteredPhonemes && profile.masteredPhonemes.length > 0) {
		const masteredList = profile.masteredPhonemes.join(', ');
		masteredNote =
			weaknesses.length < 4
				? `\nThe learner's weaknesses list is thin, so also include some pronunciation content reinforcing these recently mastered phonemes to keep them sharp: ${masteredList}\n`
				: `\nDo NOT generate pronunciation content targeting these phonemes as the student has recently mastered them: ${masteredList}\n`;
	}

	const countryNote = context?.country
		? `\nThe learner practices nursing in ${context.country} — use clinical terminology, medication names, and healthcare-system conventions appropriate to that country.\n`
		: '';

	const studentName = profile.studentName;
	const studentRole = profile.studentRole;

	const perTypeSections = DRILL_TYPES.map((drillType) => {
		const template = getTopicPrompt(
			profile.primaryMission ?? null,
			profile.primaryTopic ?? null,
			drillType
		);
		const guidance = template
			? substitutePlaceholders(template, profile, context)
			: genericDrillTypeGuidance(drillType, studentName, studentRole);
		return `\n----- ${drillType.toUpperCase()} GENERATION RULES -----\n${guidance}\n`;
	}).join('\n');

	return `
The learner has the following top weaknesses (up to 4), ranked by severity (1 = worst):

${JSON.stringify(weaknesses, null, 2)}


IMPORTANT: The evidence[] field is the primary source for all weakness-specific content. Use the listed words, phrases, and phonemes directly when creating drills. Do not invent additional weaknesses or replace them with generic examples.
- For pronunciation: use the weak phonemes listed in evidence to select words that target those specific sounds
- For vocabulary: use the exact words listed in 'Struggled with:' from the evidence field
- For key_phrases: base the clinical scenarios on the student's actual drill context
- For roleplay: create scenarios that naturally incorporate the student's weak areas from evidence

IMPORTANT: The four drills must complement each other rather than repeat each other.
- pronunciation: target weak phonemes using words from the evidence field.
- vocabulary: teach the meaning and correct clinical usage of weak words from the evidence field.
- roleplay: build realistic clinical conversations that exercise the same underlying communication weaknesses without reusing the exact vocabulary items from the pronunciation or vocabulary drills.
- key_phrases: practise selecting the most appropriate professional response in realistic clinical situations.

Distribute the student's weak areas across the four drills so each focuses on a different aspect of the learner's performance.

Generate exactly four ChallengeDrillItems:
1. pronunciation
2. vocabulary
3. roleplay
4. key_phrases

Each drillType must be unique and exactly match one of the four values above.

Use these exact instructions per drill type:
- pronunciation: "Practice these words and phrases focusing on clear pronunciation."
- vocabulary: "Focus on using these vocabularies correctly. Pay attention to the meaning and appropriate usage."
- roleplay: "Improve your speaking and conversational skills in these difficult scenarios. Make your mistakes here, not during your shift."
- key_phrases: "Practice responding in these clinical situations using the correct key phrases."
${masteredNote}${countryNote}
Below are the detailed generation rules for each drill type. Some sections below are drawn from a hand-authored, mission/topic-specific template and may reference their own JSON output format (bare arrays, different field names, or their own "Return a JSON array/object" instructions) — IGNORE any such format instructions inside these sections. Use each section ONLY for its content, realism, difficulty, and constraint guidance. The ONE and ONLY valid output format is the unified schema specified at the end of this prompt.
${perTypeSections}

Return a JSON object with this exact shape:

{
  "drillSequence": [
    {
      "drillType": "<pronunciation | vocabulary | key_phrases | roleplay>",
      "targetWeakness": {
        "drillType": "<string>",
        "category": "<pronunciation|fluency|vocabulary|grammar>",
        "severity": <number 0–1>,
        "evidence": ["<string>"],
        "label": "<string>"
      },
      "instructions": "<use the exact instruction string for this drillType as specified above>",
      "generatedContent": <see per-type schema below>,
      "estimatedMinutes": <number>
    }
  ],
  "totalEstimatedMinutes": <sum of estimatedMinutes>,
  "summaryMessage": "Personalized to address your weakest areas"
}

Per-type generatedContent schemas (this is the REQUIRED output shape for generatedContent, regardless of which generation rules section above you used for content):

${genericDrillTypeGuidance('pronunciation', studentName, studentRole)}

${genericDrillTypeGuidance('vocabulary', studentName, studentRole)}

${genericDrillTypeGuidance('key_phrases', studentName, studentRole)}

${genericDrillTypeGuidance('roleplay', studentName, studentRole)}

Return ONLY valid JSON with this exact shape, no markdown, no preamble.
`.trim();
}

// Topic-specific prompts (topic-prompts/mission-*.ts) instruct the model to
// return a bare JSON array for these three drill types — not the object-wrapped
// shape used by the generic buildPrompt() flow. Accept the array and normalize
// it into the same *_items shape the rest of the app expects.
const pronunciationContentSchema = z
	.array(z.object({ word: z.string(), sentence: z.string(), sound: z.string().optional() }))
	.transform((items) => ({ pronunciation_items: items }));

const vocabularyContentSchema = z
	.array(
		z.object({
			vocabulary: z.string().optional(),
			sentence: z.string(),
			correctAnswer: z.string(),
			options: z.array(z.string()),
		})
	)
	.transform((items) => ({
		vocabulary_items: items.map((item) => ({
			sentence: item.sentence,
			blanks: [{ position: 0, correctAnswer: item.correctAnswer, options: item.options }],
		})),
	}));

const keyPhrasesContentSchema = z
	.array(
		z.object({
			prompt: z.string(),
			options: z.array(z.string()),
			correctAnswer: z.string(),
			respondentName: z.string().optional(),
		})
	)
	.transform((items) => ({ key_phrase_items: items }));

const roleplayContentSchema = z.object({
	student_character_name: z.string(),
	ai_character_names: z.array(z.string()),
	context: z.string().optional(),
	roleplay_scenes: z.array(
		z.object({
			scene_name: z.string().optional(),
			scene_title: z.string().optional(),
			dialogue: z.array(z.object({ speaker: z.string(), text: z.string() })),
		})
	),
});

const TOPIC_CONTENT_SCHEMAS: Record<TopicDrillType, z.ZodTypeAny> = {
	pronunciation: pronunciationContentSchema,
	vocabulary: vocabularyContentSchema,
	key_phrases: keyPhrasesContentSchema,
	roleplay: roleplayContentSchema,
};

/**
 * Topic-specific templates sometimes ask for a bare JSON array (pronunciation,
 * vocabulary, key_phrases) and sometimes a JSON object (roleplay). A greedy
 * `\{[\s\S]*\}` match will false-positive on an array of objects (it spans
 * from the first `{` to the last `}`, skipping the wrapping brackets), so try
 * the shape we expect for this drill type first, then fall back to the other
 * shape in case the model didn't follow instructions exactly.
 */
function extractJsonPayload(text: string, preferArray: boolean): unknown {
	const arrayMatch = text.match(/\[[\s\S]*\]/);
	const objectMatch = text.match(/\{[\s\S]*\}/);
	const candidates = preferArray
		? [arrayMatch?.[0], objectMatch?.[0]]
		: [objectMatch?.[0], arrayMatch?.[0]];

	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			return JSON.parse(candidate);
		} catch {
			// try the next candidate
		}
	}
	return null;
}

async function generateTopicSpecificDrill(
	drillType: TopicDrillType,
	template: string,
	profile: WeaknessProfile,
	context?: ChallengeGenerationContext
): Promise<ChallengeDrillItem | null> {
	const prompt = substitutePlaceholders(template, profile, context);

	const responseText = await generateChallengeCompletion({
		systemInstruction: SYSTEM_INSTRUCTION,
		prompt,
		maxCompletionTokens: 4000,
	});

	const raw = extractJsonPayload(responseText, drillType !== 'roleplay');
	if (raw === null) return null;

	const validation = TOPIC_CONTENT_SCHEMAS[drillType].safeParse(raw);
	if (!validation.success) return null;

	let generatedContent = validation.data;
	if (drillType === 'roleplay') {
		const rp = generatedContent as z.infer<typeof roleplayContentSchema>;
		generatedContent = {
			...rp,
			roleplay_scenes: rp.roleplay_scenes.map((scene) => ({
				scene_name: scene.scene_name ?? scene.scene_title,
				dialogue: scene.dialogue,
			})),
		};
	}

	const targetWeakness =
		profile.topWeaknesses.find((w) => w.drillType === drillType) ??
		profile.topWeaknesses[0] ?? {
			drillType,
			category: 'vocabulary' as const,
			severity: 0,
			evidence: [],
			label: 'General practice',
		};

	return {
		drillType,
		targetWeakness,
		instructions: INSTRUCTIONS_BY_TYPE[drillType],
		generatedContent: generatedContent as ChallengeDrillItem['generatedContent'],
		estimatedMinutes: 10,
	};
}

async function generateBaselineChallenge(
	profile: WeaknessProfile,
	context?: ChallengeGenerationContext
): Promise<WeeklyChallenge['content']> {
	const responseText = await generateChallengeCompletion({
		systemInstruction: SYSTEM_INSTRUCTION,
		prompt: buildPrompt(profile, context),
		maxCompletionTokens: 10000,
	});

	const match = responseText.match(/\{[\s\S]*\}/);
	if (!match) {
		throw new Error('Gemini response did not contain a JSON object');
	}

	let raw: unknown;
	try {
		raw = JSON.parse(match[0]);
	} catch (e: any) {
		throw new Error('Gemini returned malformed JSON: ' + e.message);
	}

	// Sanitize evidence[]: model occasionally returns objects instead of strings
	try {
		const sequence = (raw as any)?.drillSequence;
		if (Array.isArray(sequence)) {
			for (const item of sequence) {
				const evidence = item?.targetWeakness?.evidence;
				if (!Array.isArray(evidence)) continue;
				item.targetWeakness.evidence = evidence.map((e: unknown) => {
					if (typeof e === 'string') return e;
					if (e && typeof e === 'object') {
						const obj = e as Record<string, unknown>;
						return String(obj.text ?? obj.description ?? obj.label ?? JSON.stringify(e));
					}
					return String(e);
				});
			}
		}
	} catch {
		// non-fatal — let Zod validation surface any remaining shape issues
	}

	const validation = contentSchema.safeParse(raw);
	if (!validation.success) {
		throw new Error(
			'Gemini returned invalid content shape: ' +
				(validation.error.issues[0]?.message ?? 'unknown')
		);
	}

	// Post-process key_phrases items: ensure correctAnswer exactly matches one of options[]
	for (const item of validation.data.drillSequence) {
		if (item.drillType !== 'key_phrases') continue;
		const content = item.generatedContent as any;
		const kpItems: any[] = Array.isArray(content?.key_phrase_items) ? content.key_phrase_items : [];
		for (const kpItem of kpItems) {
			const options: string[] = Array.isArray(kpItem?.options) ? kpItem.options : [];
			const correctAnswer: string = kpItem?.correctAnswer ?? '';
			if (options.includes(correctAnswer)) continue;
			// Find the option with the most words in common with correctAnswer
			const correctWords = correctAnswer.toLowerCase().split(/\s+/);
			let bestOption = options[0] ?? correctAnswer;
			let bestScore = -1;
			for (const option of options) {
				const overlap = option.toLowerCase().split(/\s+/).filter((w) => correctWords.includes(w)).length;
				if (overlap > bestScore) {
					bestScore = overlap;
					bestOption = option;
				}
			}
			console.warn(
				`[challenge-generator] key_phrases correctAnswer mismatch — correcting "${correctAnswer}" → "${bestOption}"`
			);
			kpItem.correctAnswer = bestOption;
		}
	}

	return validation.data as WeeklyChallenge['content'];
}

export async function generateWeeklyChallenge(
	profile: WeaknessProfile,
	context?: ChallengeGenerationContext
): Promise<WeeklyChallenge['content']> {
	const responseText = await generateChallengeCompletion({
		systemInstruction: SYSTEM_INSTRUCTION,
		prompt: buildCombinedPrompt(profile, context),
		maxCompletionTokens: 10000,
	});

	const match = responseText.match(/\{[\s\S]*\}/);
	if (!match) {
		throw new Error('OpenAI response did not contain a JSON object');
	}

	let raw: unknown;
	try {
		raw = JSON.parse(match[0]);
	} catch (e: any) {
		throw new Error('OpenAI returned malformed JSON: ' + e.message);
	}

	// Sanitize evidence[]: model occasionally returns objects instead of strings
	try {
		const sequence = (raw as any)?.drillSequence;
		if (Array.isArray(sequence)) {
			for (const item of sequence) {
				const evidence = item?.targetWeakness?.evidence;
				if (!Array.isArray(evidence)) continue;
				item.targetWeakness.evidence = evidence.map((e: unknown) => {
					if (typeof e === 'string') return e;
					if (e && typeof e === 'object') {
						const obj = e as Record<string, unknown>;
						return String(obj.text ?? obj.description ?? obj.label ?? JSON.stringify(e));
					}
					return String(e);
				});
			}
		}
	} catch {
		// non-fatal — let Zod validation surface any remaining shape issues
	}

	const validation = contentSchema.safeParse(raw);
	if (!validation.success) {
		throw new Error(
			'OpenAI returned invalid content shape: ' +
				(validation.error.issues[0]?.message ?? 'unknown')
		);
	}

	// Post-process key_phrases items: ensure correctAnswer exactly matches one of options[]
	for (const item of validation.data.drillSequence) {
		if (item.drillType !== 'key_phrases') continue;
		const content = item.generatedContent as any;
		const kpItems: any[] = Array.isArray(content?.key_phrase_items) ? content.key_phrase_items : [];
		for (const kpItem of kpItems) {
			const options: string[] = Array.isArray(kpItem?.options) ? kpItem.options : [];
			const correctAnswer: string = kpItem?.correctAnswer ?? '';
			if (options.includes(correctAnswer)) continue;
			// Find the option with the most words in common with correctAnswer
			const correctWords = correctAnswer.toLowerCase().split(/\s+/);
			let bestOption = options[0] ?? correctAnswer;
			let bestScore = -1;
			for (const option of options) {
				const overlap = option.toLowerCase().split(/\s+/).filter((w) => correctWords.includes(w)).length;
				if (overlap > bestScore) {
					bestScore = overlap;
					bestOption = option;
				}
			}
			console.warn(
				`[challenge-generator] key_phrases correctAnswer mismatch — correcting "${correctAnswer}" → "${bestOption}"`
			);
			kpItem.correctAnswer = bestOption;
		}
	}

	return validation.data as WeeklyChallenge['content'];
}
