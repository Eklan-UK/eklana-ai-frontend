/**
 * Live API function-declaration for the phase-advance tool call. Shared by
 * opening/route.ts and turn/route.ts so both relay requests for the same
 * session send an identical tool definition — the relay's cached-session
 * reuse only applies tools from whichever request establishes the
 * connection, so the first request for a session must already include this.
 */
export const advancePhaseTool = {
	name: 'advancePhase',
	description:
		"Call this when the current phase's trigger condition has been clearly and fully satisfied by the conversation so far.",
	parameters: { type: 'object', properties: {} },
};

export interface SimulationPromptScenario {
	dramatisationPrompt: string;
}

export interface SimulationPromptConversationBeat {
	character: string;
	intent: string;
	triggerCondition: string;
}

export interface SimulationPromptPhase {
	phaseTitle: string;
	triggerCondition: string;
	characters: string[];
	conversationBeats: SimulationPromptConversationBeat[];
}

/**
 * Builds the system instruction for a Simulation Room live turn session,
 * scoped to a single phase of a scenario's scenarioScript.
 */
export function buildSimulationSystemInstruction(
	scenario: SimulationPromptScenario,
	phase: SimulationPromptPhase,
	studentCharacterName: string,
	secondsRemaining?: number
): string {
	const beatsList = phase.conversationBeats
		.map(
			(beat) =>
				`- ${beat.character}: work toward "${beat.intent}" (trigger: ${beat.triggerCondition})`
		)
		.join('\n');

	const windDownInstruction =
		secondsRemaining !== undefined && secondsRemaining < 30
			? `\n\nTime is almost up (${secondsRemaining} seconds remaining) — begin naturally concluding this interaction in character (e.g. wrapping up, handing off, or reaching a natural pause) rather than starting new threads.`
			: '';

	return `The student is playing the role of ${studentCharacterName}. You must NEVER voice, narrate, or address the student as ${studentCharacterName} or as any other character. The student speaks for themselves — you only ever play the OTHER characters listed above, reacting to what the student says. Do not describe what ${studentCharacterName} is doing or feeling.

BACKGROUND CONTEXT (for your understanding only — never speak, read aloud, or paraphrase this block as dialogue; it may be written in second person addressing the student, but you are not the student and must never voice these lines):
"""
${scenario.dramatisationPrompt}
"""
Everything above this line is silent background context. Your actual spoken dialogue must come only from your own in-character reactions to the conversation, guided by the conversation beats below — never recite scenario framing or instructions aloud.

You are voicing this workplace communication training simulation live, in real time, with a student.

Current phase: "${phase.phaseTitle}"
Active characters this phase: ${phase.characters.join(', ')}

Conversation beats for this phase — these are intents to work toward, NOT scripted lines. Generate natural, in-character wording and respond live to whatever the student actually says:
${beatsList}

Phase advancement: this phase ends when the following trigger condition is clearly and fully satisfied: "${phase.triggerCondition}". When you are confident this condition has been met by the conversation so far, call the advancePhase tool. Do not call it prematurely or on partial/ambiguous progress.

Reminder: you are never ${studentCharacterName}. Every line you generate must come from one of the other characters listed above, reacting to what the student just said.${windDownInstruction}`;
}
