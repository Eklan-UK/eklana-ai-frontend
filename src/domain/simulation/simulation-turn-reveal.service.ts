import { logger } from '@/lib/api/logger';
import { genAI, DEFAULT_MODEL } from '@/services/gemini.service';

export interface UnrevealedFinding {
	label: string;
	revealCondition: string;
}

export interface TurnRevealResult {
	revealedLabels: string[];
}

function buildRevealPrompt(
	studentTurnText: string,
	unrevealedFindings: UnrevealedFinding[]
): string {
	return `You are judging whether a student's turn in a workplace communication training simulation has satisfied the reveal conditions for any currently-hidden findings.

Student's most recent turn:
${studentTurnText}

Findings not yet revealed (label and reveal condition only):
${JSON.stringify(unrevealedFindings, null, 2)}

For each finding, determine whether the student's turn DIRECTLY and CLEARLY satisfies its stated revealCondition — not just topical relevance. If you are uncertain, do not include it.

Return ONLY valid JSON with this exact shape:
{
  "revealedLabels": [<string>, ...]
}

revealedLabels must be a subset of the input labels (it can be empty).`;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateRevealShape(parsed: any): asserts parsed is TurnRevealResult {
	if (!isStringArray(parsed?.revealedLabels)) {
		throw new Error('Invalid turn reveal response shape: revealedLabels must be an array of strings');
	}
}

async function callGeminiForReveal(
	studentTurnText: string,
	unrevealedFindings: UnrevealedFinding[]
): Promise<TurnRevealResult> {
	if (!genAI) {
		throw new Error('Gemini API is not configured');
	}

	const model = genAI.getGenerativeModel({
		model: DEFAULT_MODEL,
		generationConfig: {
			temperature: 0.1,
			maxOutputTokens: 500,
		},
	});

	const prompt = buildRevealPrompt(studentTurnText, unrevealedFindings);
	const result = await model.generateContent(prompt);
	const responseText = result.response.text();

	const jsonMatch = responseText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse turn reveal response');
	}

	const parsed = JSON.parse(jsonMatch[0]);
	validateRevealShape(parsed);

	return parsed;
}

/**
 * Determine which not-yet-revealed findings should now be shown based on the
 * student's most recent turn. Retries once on malformed JSON or failed shape
 * validation before giving up. Defensively filters revealedLabels down to
 * only labels present in the input, in case the model hallucinates one.
 */
export async function checkFindingReveals(
	studentTurnText: string,
	unrevealedFindings: Array<{ label: string; revealCondition: string }>,
	retriesRemaining = 1
): Promise<{ revealedLabels: string[] }> {
	try {
		const result = await callGeminiForReveal(studentTurnText, unrevealedFindings);
		const validLabels = new Set(unrevealedFindings.map((finding) => finding.label));
		return {
			revealedLabels: result.revealedLabels.filter((label) => validLabels.has(label)),
		};
	} catch (error: any) {
		if (retriesRemaining > 0) {
			logger.warn('Turn reveal check failed, retrying once', { error: error.message });
			return checkFindingReveals(studentTurnText, unrevealedFindings, retriesRemaining - 1);
		}
		logger.error('Error checking simulation turn reveals', { error: error.message });
		throw new Error(`Failed to check simulation turn reveals: ${error.message}`);
	}
}
