import { logger } from '@/lib/api/logger';
import { genAI, DEFAULT_MODEL } from '@/services/gemini.service';

export interface ScenarioConversationBeat {
	character: string;
	intent: string;
	triggerCondition: string;
}

export interface ScenarioGatedFinding {
	label: string;
	data: string;
	revealCondition: string;
}

export interface ScenarioPhase {
	phaseName: string;
	triggerCondition: string;
	characters: string[];
	conversationBeats: ScenarioConversationBeat[];
	gatedFindings: ScenarioGatedFinding[];
}

export interface ScenarioExtractionResult {
	displayData: string;
	studentHint: string;
	hiddenContext: string;
	scenarioScript: ScenarioPhase[];
}

function buildExtractionPrompt(rawSlideText: string, studentCharacterName: string): string {
	return `You are extracting structured content from a tutor's uploaded slide deck to build a workplace communication training simulation. The simulation could be set in any workplace context — medical, hospitality, customer service, or otherwise — so do not assume a fixed domain or a fixed number of phases. Derive everything from what is actually present in the deck.

The learner/student plays the role of ${studentCharacterName}. Do NOT include ${studentCharacterName} in any phase's characters array or conversationBeats — the AI never voices or narrates this character, since the student speaks for themselves.

Extract exactly four things:

1. displayData — ALL baseline information a person in this role would realistically already know or see at the very start of the encounter: the presenting complaint/situation, baseline readings/status, and any chart, handoff, or briefing data given up front. This belongs in displayData EVEN IF the source deck presents it under a separate "findings" or "assessment" heading/slide — where the deck puts it does not matter, only whether it would already be known at scene start. Do not move baseline information into gatedFindings just because the deck labels it as a finding. This will be read aloud by an AI voice at the start of the session, so rewrite it as natural, sayable spoken paragraphs — not bullet fragments and not text copied verbatim from slides.

2. scenarioScript — an array of phase objects covering everything that unfolds DURING the interaction. Derive the number and structure of phases from the deck's actual content. Each phase object has:
   - phaseName: string
   - triggerCondition: string — what starts this phase
   - characters: string[] — which roles/characters are active in this phase (e.g. "patient", "supervisor", "colleague")
   - conversationBeats: array of { character, intent, triggerCondition } — intent describes WHAT the character should communicate or accomplish in natural language (e.g. "reports sudden distress, sounds anxious"), NOT a verbatim scripted line, since a separate live AI will generate the actual wording and respond to the learner in real time
   - gatedFindings: array of { label, data, revealCondition } — any data/information meant to be displayed on screen only after a trigger condition is met (e.g. after the learner performs an assessment or requests information); this is never spoken aloud. Reserve gatedFindings ONLY for information that requires the learner to actively assess, ask, or act during the encounter to discover — information that would NOT plausibly be known yet at scene start. If it's baseline information already known at the start, it belongs in displayData instead, regardless of which slide/heading the deck put it under. Example: a baseline oxygen saturation reading given in the deck's patient snapshot belongs in displayData, not gatedFindings, even if the deck lists it under an "assessment findings" header — only a CHANGED or newly-measured reading taken during the encounter (e.g. a repeat SpO2 check after an intervention) belongs in gatedFindings.

3. studentHint — optional on-demand reference material the learner could look up if they choose to; it is not shown automatically. Return an empty string if the deck has no such content.

4. hiddenContext — facilitator-only material never shown to the learner: scoring checklists, model/ideal answers, debrief questions, and deck framing/mission-briefing slides not meant for the learner. Return this as a single string, joining/summarizing distinct facilitator sections clearly.

Raw slide text:
${rawSlideText}

Return ONLY valid JSON with this exact shape:
{
  "displayData": <string, sayable spoken-prose background/setup info>,
  "scenarioScript": [
    {
      "phaseName": <string>,
      "triggerCondition": <string>,
      "characters": [<string>, ...],
      "conversationBeats": [
        { "character": <string>, "intent": <string>, "triggerCondition": <string> }
      ],
      "gatedFindings": [
        { "label": <string>, "data": <string>, "revealCondition": <string> }
      ]
    }
  ],
  "studentHint": <string, empty string if none>,
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

function isValidGatedFinding(value: unknown): value is ScenarioGatedFinding {
	if (typeof value !== 'object' || value === null) return false;
	const finding = value as Record<string, unknown>;
	return (
		isNonEmptyString(finding.label) &&
		isNonEmptyString(finding.data) &&
		isNonEmptyString(finding.revealCondition)
	);
}

export function isValidPhase(value: unknown): value is ScenarioPhase {
	if (typeof value !== 'object' || value === null) return false;
	const phase = value as Record<string, unknown>;
	return (
		isNonEmptyString(phase.phaseName) &&
		isNonEmptyString(phase.triggerCondition) &&
		isStringArray(phase.characters) &&
		Array.isArray(phase.conversationBeats) &&
		phase.conversationBeats.every(isValidConversationBeat) &&
		Array.isArray(phase.gatedFindings) &&
		phase.gatedFindings.every(isValidGatedFinding)
	);
}

function validateExtractionShape(parsed: any): asserts parsed is ScenarioExtractionResult {
	if (!isNonEmptyString(parsed?.displayData)) {
		throw new Error('Invalid scenario extraction response shape: displayData must be a non-empty string');
	}
	if (typeof parsed?.studentHint !== 'string') {
		throw new Error('Invalid scenario extraction response shape: studentHint must be a string');
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
			// scenarioScript now asks for a full multi-phase breakdown (per-phase
			// characters, conversation beats, and gated findings) on top of the
			// original displayData/hiddenContext split, so the structured output
			// is substantially larger than the old 2-field shape. Raised from
			// 8000 to 16000 to leave headroom for decks with several phases.
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
 * Extract displayData, scenarioScript, studentHint, and hiddenContext from
 * raw parsed slide text using Gemini. Retries once on malformed JSON or
 * failed shape validation before giving up.
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
