import { logger } from '@/lib/api/logger';
import { genAI, DEFAULT_MODEL } from '@/services/gemini.service';

export interface ScenarioConversationBeat {
	character: string;
	intent: string;
	triggerCondition: string;
}

export interface ScenarioPhase {
	phaseTitle: string;
	situation: string;
	clinicalInformation: string;
	triggerCondition: string;
	characters: string[];
	conversationBeats: ScenarioConversationBeat[];
}

export interface ScenarioHint {
	phaseTitle: string;
	hintText: string;
}

export interface ScenarioExtractionResult {
	background: string;
	patientInformation: string;
	hints: ScenarioHint[];
	hiddenContext: string;
	scenarioScript: ScenarioPhase[];
}

function buildExtractionPrompt(rawSlideText: string, studentCharacterName: string): string {
	return `You are extracting structured content from a tutor's uploaded slide deck to build a workplace communication training simulation. The simulation could be set in any workplace context — medical, hospitality, customer service, or otherwise — so do not assume a fixed domain or a fixed number of phases. Derive everything from what is actually present in the deck.

The learner/student plays the role of ${studentCharacterName}. Do NOT include ${studentCharacterName} in any phase's characters array or conversationBeats — the AI never voices or narrates this character, since the student speaks for themselves.

Extract exactly five things:

1. background — ALL baseline situational information a person in this role would realistically already know or see at the very start of the encounter: the presenting complaint/situation, setting, and any handoff or briefing context given up front. This will be read aloud by an AI voice before the student sees anything else, so rewrite it as natural, sayable spoken paragraphs — not bullet fragments and not text copied verbatim from slides.

2. patientInformation — baseline readings, status, chart, or subject-specific data known at scene start (e.g. vitals, history, current state). Shown to the student right after background, and also read aloud by an AI voice, so it must also be natural, sayable spoken prose, not bullet fragments.

3. scenarioScript — an array of phase objects covering everything that unfolds DURING the interaction. Derive the number and structure of phases from the deck's actual content. Each phase object has:
   - phaseTitle: string
   - situation: string — the scene-setting text shown to the student at the start of this phase, before the conversation for this phase begins (e.g. what has changed, what's now happening). Written as plain descriptive text the student reads on screen, not spoken-audio prose.
   - clinicalInformation: string — a single plain-text block of information relevant to this phase, shown to the student on screen upfront, before that phase's conversation begins. This is NOT gated or reveal-conditioned — the student sees it immediately when the phase starts. Include here whatever information would newly become relevant or available during this phase (e.g. a repeat reading taken during the encounter, an updated status).
   - triggerCondition: string — what ends this phase / advances to the next
   - characters: string[] — which roles/characters are active in this phase (e.g. "patient", "supervisor", "colleague")
   - conversationBeats: array of { character, intent, triggerCondition } — intent describes WHAT the character should communicate or accomplish in natural language (e.g. "reports sudden distress, sounds anxious"), NOT a verbatim scripted line, since a separate live AI will generate the actual wording and respond to the learner in real time

4. hints — optional on-demand reference material the learner could look up during a specific phase if they choose to; not shown automatically. Return an array of { phaseTitle, hintText }, where phaseTitle matches one of the scenarioScript phase titles above exactly. Return an empty array if the deck has no such content. A phase may have zero, one, or multiple hints.

5. hiddenContext — facilitator-only material never shown to the learner: scoring checklists, model/ideal answers, debrief questions, and deck framing/mission-briefing slides not meant for the learner. Return this as a single string, joining/summarizing distinct facilitator sections clearly.

Raw slide text:
${rawSlideText}

Return ONLY valid JSON with this exact shape:
{
  "background": <string, sayable spoken-prose situational context>,
  "patientInformation": <string, sayable spoken-prose baseline data>,
  "scenarioScript": [
    {
      "phaseTitle": <string>,
      "situation": <string>,
      "clinicalInformation": <string>,
      "triggerCondition": <string>,
      "characters": [<string>, ...],
      "conversationBeats": [
        { "character": <string>, "intent": <string>, "triggerCondition": <string> }
      ]
    }
  ],
  "hints": [
    { "phaseTitle": <string>, "hintText": <string> }
  ],
  "hiddenContext": <string, facilitator-only material>
}`;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidConversationBeat(value: unknown): value is ScenarioConversationBeat {
	if (typeof value !== 'object' || value === null) return false;
	const beat = value as Record<string, unknown>;
	return (
		isNonEmptyString(beat.character) &&
		isNonEmptyString(beat.intent) &&
		isNonEmptyString(beat.triggerCondition)
	);
}

function isValidHint(value: unknown): value is ScenarioHint {
	if (typeof value !== 'object' || value === null) return false;
	const hint = value as Record<string, unknown>;
	return isNonEmptyString(hint.phaseTitle) && isNonEmptyString(hint.hintText);
}

export function isValidPhase(value: unknown): value is ScenarioPhase {
	if (typeof value !== 'object' || value === null) return false;
	const phase = value as Record<string, unknown>;
	return (
		isNonEmptyString(phase.phaseTitle) &&
		isNonEmptyString(phase.situation) &&
		isNonEmptyString(phase.clinicalInformation) &&
		isNonEmptyString(phase.triggerCondition) &&
		isStringArray(phase.characters) &&
		Array.isArray(phase.conversationBeats) &&
		phase.conversationBeats.every(isValidConversationBeat)
	);
}

function validateExtractionShape(parsed: any): asserts parsed is ScenarioExtractionResult {
	if (!isNonEmptyString(parsed?.background)) {
		throw new Error('Invalid scenario extraction response shape: background must be a non-empty string');
	}
	if (!isNonEmptyString(parsed?.patientInformation)) {
		throw new Error('Invalid scenario extraction response shape: patientInformation must be a non-empty string');
	}
	if (!isNonEmptyString(parsed?.hiddenContext)) {
		throw new Error('Invalid scenario extraction response shape: hiddenContext must be a non-empty string');
	}
	if (!Array.isArray(parsed?.scenarioScript) || parsed.scenarioScript.length === 0) {
		throw new Error('Invalid scenario extraction response shape: scenarioScript must be a non-empty array');
	}
	if (!parsed.scenarioScript.every(isValidPhase)) {
		throw new Error('Invalid scenario extraction response shape: scenarioScript contains a malformed phase');
	}
	if (!Array.isArray(parsed?.hints) || !parsed.hints.every(isValidHint)) {
		throw new Error('Invalid scenario extraction response shape: hints must be an array of { phaseTitle, hintText }');
	}
}

// Deterministic backstop: strip the student's own character from the LLM's
// output regardless of whether the prompt instruction was followed, since the
// model has demonstrated unreliability on similar instructions.
function stripStudentCharacter(
	scenarioScript: ScenarioPhase[],
	studentCharacterName: string
): ScenarioPhase[] {
	const needle = studentCharacterName.trim().toLowerCase();
	const matchesStudent = (name: string) => name.trim().toLowerCase().includes(needle);

	return scenarioScript.map((phase) => ({
		...phase,
		characters: phase.characters.filter((character) => !matchesStudent(character)),
		conversationBeats: phase.conversationBeats.filter(
			(beat) => !matchesStudent(beat.character)
		),
	}));
}

async function callGeminiForExtraction(
	rawSlideText: string,
	studentCharacterName: string
): Promise<ScenarioExtractionResult> {
	if (!genAI) {
		throw new Error('Gemini API is not configured');
	}

	const model = genAI.getGenerativeModel({
		model: DEFAULT_MODEL,
		generationConfig: {
			temperature: 0.2,
			// scenarioScript asks for a full multi-phase breakdown (per-phase
			// characters, conversation beats, situation, and clinical info) on top
			// of background/patientInformation/hints/hiddenContext, so the
			// structured output is substantial. Kept at 16000 to leave headroom for
			// decks with several phases.
			maxOutputTokens: 16000,
		},
	});

	const prompt = buildExtractionPrompt(rawSlideText, studentCharacterName);
	const result = await model.generateContent(prompt);
	const responseText = result.response.text();

	const jsonMatch = responseText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse scenario extraction response');
	}

	const parsed = JSON.parse(jsonMatch[0]);
	validateExtractionShape(parsed);

	parsed.scenarioScript = stripStudentCharacter(parsed.scenarioScript, studentCharacterName);

	return parsed;
}

/**
 * Extract background, patientInformation, scenarioScript, hints, and
 * hiddenContext from raw parsed slide text using Gemini. Retries once on
 * malformed JSON or failed shape validation before giving up.
 */
export async function extractScenarioContext(
	rawSlideText: string,
	studentCharacterName: string,
	retriesRemaining = 1
): Promise<ScenarioExtractionResult> {
	try {
		return await callGeminiForExtraction(rawSlideText, studentCharacterName);
	} catch (error: any) {
		if (retriesRemaining > 0) {
			logger.warn('Scenario extraction failed, retrying once', { error: error.message });
			return extractScenarioContext(rawSlideText, studentCharacterName, retriesRemaining - 1);
		}
		logger.error('Error extracting simulation scenario context', { error: error.message });
		throw new Error(`Failed to extract simulation scenario context: ${error.message}`);
	}
}
