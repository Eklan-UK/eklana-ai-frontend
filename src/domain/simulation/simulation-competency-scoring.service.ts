import { logger } from '@/lib/api/logger';
import { genAI, DEFAULT_MODEL } from '@/services/gemini.service';

export interface CompetencyScoringTranscriptTurn {
	turnNumber: number;
	role: 'student' | 'ai';
	text: string;
}

export interface CompetencyScore {
	competencyName: string;
	rating: 'exceeds' | 'meets' | 'fails';
	evidence: string;
}

export interface CompetencyScoringResult {
	competencyScores: CompetencyScore[];
	overallSummary: string;
}

function buildCompetencyScoringPrompt(
	gradingRubric: string,
	transcript: CompetencyScoringTranscriptTurn[],
	weeklyFocus: string[]
): string {
	const formattedTranscript = transcript
		.map((turn) => `[Turn ${turn.turnNumber} - ${turn.role}] ${turn.text}`)
		.join('\n');

	return `You are grading a language learner's performance in a workplace communication training simulation against a tutor-written grading rubric.

First, identify the distinct competencies described in the grading rubric below. The tutor wrote it in free-form — do not assume a fixed number or shape of competencies; derive them from what is actually written.

For each competency, score the STUDENT's execution across the full transcript as one of:
- "exceeds" — immediate, precise execution without hesitation.
- "meets" — competency achieved, but with slight delays or minor prompting.
- "fails" — missed the core objective, provided unsafe instructions, or broke professional character.

For each score, cite specific evidence from the transcript by quoting or paraphrasing a student turn along with its turnNumber. Do not give an unsupported rating.

This week's target competencies are:
${weeklyFocus.map((focus) => `- ${focus}`).join('\n')}

Weight your assessment toward these weeklyFocus competencies as the primary evaluation targets. Anything else identified from the grading rubric is secondary context.

Finally, provide an overallSummary: 1-3 sentences a tutor can read as a quick verdict on the session.

Grading rubric:
${gradingRubric}

Transcript:
${formattedTranscript}

Return ONLY valid JSON with this exact shape:
{
  "competencyScores": [
    {
      "competencyName": <string>,
      "rating": "exceeds" | "meets" | "fails",
      "evidence": <string>
    }
  ],
  "overallSummary": <string>
}`;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isValidRating(value: unknown): value is CompetencyScore['rating'] {
	return value === 'exceeds' || value === 'meets' || value === 'fails';
}

function hasValidCompetencyScoreFields(value: unknown): value is Omit<CompetencyScore, 'rating'> & { rating: string } {
	if (typeof value !== 'object' || value === null) return false;
	const score = value as Record<string, unknown>;
	return (
		isNonEmptyString(score.competencyName) &&
		isNonEmptyString(score.rating) &&
		isNonEmptyString(score.evidence)
	);
}

function validateCompetencyScoringShape(
	parsed: any
): asserts parsed is { competencyScores: (Omit<CompetencyScore, 'rating'> & { rating: string })[]; overallSummary: string } {
	if (!Array.isArray(parsed?.competencyScores)) {
		throw new Error('Invalid competency scoring response shape: competencyScores must be an array');
	}
	if (!parsed.competencyScores.every(hasValidCompetencyScoreFields)) {
		throw new Error('Invalid competency scoring response shape: competencyScores contains a malformed entry');
	}
	if (!isNonEmptyString(parsed?.overallSummary)) {
		throw new Error('Invalid competency scoring response shape: overallSummary must be a non-empty string');
	}
}

async function callGeminiForCompetencyScoring(
	gradingRubric: string,
	transcript: CompetencyScoringTranscriptTurn[],
	weeklyFocus: string[]
): Promise<CompetencyScoringResult> {
	if (!genAI) {
		throw new Error('Gemini API is not configured');
	}

	const model = genAI.getGenerativeModel({
		model: DEFAULT_MODEL,
		generationConfig: {
			temperature: 0.3,
			maxOutputTokens: 3000,
		},
	});

	const prompt = buildCompetencyScoringPrompt(gradingRubric, transcript, weeklyFocus);
	const result = await model.generateContent(prompt);
	const responseText = result.response.text();

	const jsonMatch = responseText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse competency scoring response');
	}

	const parsed = JSON.parse(jsonMatch[0]);
	validateCompetencyScoringShape(parsed);

	// validateCompetencyScoringShape only checks field presence/types, not that
	// rating is one of the allowed literals — drop individual entries with an
	// unrecognized rating rather than failing the whole batch.
	return {
		competencyScores: parsed.competencyScores.filter((score: { rating: string }) =>
			isValidRating(score.rating)
		) as CompetencyScore[],
		overallSummary: parsed.overallSummary,
	};
}

/**
 * Score a student's competencies for a simulation session against a tutor's
 * grading rubric using Gemini. Retries once on malformed JSON or failed shape
 * validation before giving up.
 */
export async function scoreCompetencies(
	gradingRubric: string,
	transcript: CompetencyScoringTranscriptTurn[],
	weeklyFocus: string[],
	retriesRemaining = 1
): Promise<CompetencyScoringResult> {
	try {
		return await callGeminiForCompetencyScoring(gradingRubric, transcript, weeklyFocus);
	} catch (error: any) {
		if (retriesRemaining > 0) {
			logger.warn('Competency scoring failed, retrying once', { error: error.message });
			return scoreCompetencies(gradingRubric, transcript, weeklyFocus, retriesRemaining - 1);
		}
		logger.error('Error scoring simulation competencies', { error: error.message });
		throw new Error(`Failed to score simulation competencies: ${error.message}`);
	}
}
