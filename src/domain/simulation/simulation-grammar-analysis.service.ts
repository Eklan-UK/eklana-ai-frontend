import { logger } from '@/lib/api/logger';
import { genAI, DEFAULT_MODEL } from '@/services/gemini.service';

export interface GrammarAnalysisTranscriptTurn {
	turnNumber: number;
	role: 'student' | 'ai';
	text: string;
}

export interface GrammarAnalysisError {
	studentTurnNumber: number;
	quotedText: string;
	errorType: 'context_error' | 'phrasing_error';
	correctedVersion: string;
	explanation: string;
}

export interface GrammarAnalysisResult {
	errors: GrammarAnalysisError[];
}

function buildGrammarAnalysisPrompt(transcript: GrammarAnalysisTranscriptTurn[]): string {
	const formattedTranscript = transcript
		.map((turn) => `[Turn ${turn.turnNumber} - ${turn.role}] ${turn.text}`)
		.join('\n');

	return `You are grading a language learner's spoken turns from a workplace communication training simulation for grammar and contextual appropriateness. You are given the full conversation transcript, including both the student's and the AI character's turns, so you have the conversational context needed to judge whether the student's language fit what was actually being asked or needed at that point.

Only flag STUDENT turns. Never analyze or flag the AI's lines — they are shown to you only for context.

Apply this exact grading rubric:
- "context_error" — a correctly pronounced/grammatical word or phrase applied in the wrong situational context. The words are fine individually, but wrong for what was being asked or needed here.
- "phrasing_error" — incorrect grammar, preposition, or sentence structure (e.g. "stay at bed with me" instead of "stay in bed for me").

Do NOT flag minor stylistic variation, accent-influenced word choice that is still grammatically valid, or anything that is merely not the most natural phrasing but is still correct. Only flag genuine errors.

For each flagged error, quote the exact problematic text, classify it as one of the two error types above, provide a corrected version, and a one-sentence explanation a tutor could read.

If the student's language is generally clean, return an empty errors array. Do not manufacture errors just to have something to report.

Transcript:
${formattedTranscript}

Return ONLY valid JSON with this exact shape:
{
  "errors": [
    {
      "studentTurnNumber": <number>,
      "quotedText": <string>,
      "errorType": "context_error" | "phrasing_error",
      "correctedVersion": <string>,
      "explanation": <string>
    }
  ]
}`;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isValidErrorType(value: unknown): value is GrammarAnalysisError['errorType'] {
	return value === 'context_error' || value === 'phrasing_error';
}

function hasValidGrammarAnalysisErrorFields(value: unknown): value is Omit<GrammarAnalysisError, 'errorType'> & { errorType: string } {
	if (typeof value !== 'object' || value === null) return false;
	const err = value as Record<string, unknown>;
	return (
		typeof err.studentTurnNumber === 'number' &&
		isNonEmptyString(err.quotedText) &&
		isNonEmptyString(err.errorType) &&
		isNonEmptyString(err.correctedVersion) &&
		isNonEmptyString(err.explanation)
	);
}

function validateGrammarAnalysisShape(parsed: any): asserts parsed is { errors: (Omit<GrammarAnalysisError, 'errorType'> & { errorType: string })[] } {
	if (!Array.isArray(parsed?.errors)) {
		throw new Error('Invalid grammar analysis response shape: errors must be an array');
	}
	if (!parsed.errors.every(hasValidGrammarAnalysisErrorFields)) {
		throw new Error('Invalid grammar analysis response shape: errors contains a malformed entry');
	}
}

async function callGeminiForGrammarAnalysis(
	transcript: GrammarAnalysisTranscriptTurn[]
): Promise<GrammarAnalysisResult> {
	if (!genAI) {
		throw new Error('Gemini API is not configured');
	}

	const model = genAI.getGenerativeModel({
		model: DEFAULT_MODEL,
		generationConfig: {
			temperature: 0.2,
			maxOutputTokens: 4000, // transcripts can run long across a 15-min session
		},
	});

	const prompt = buildGrammarAnalysisPrompt(transcript);
	const result = await model.generateContent(prompt);
	const responseText = result.response.text();

	const jsonMatch = responseText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse grammar analysis response');
	}

	const parsed = JSON.parse(jsonMatch[0]);
	validateGrammarAnalysisShape(parsed);

	// validateGrammarAnalysisShape only checks field presence/types, not that
	// errorType is one of the allowed literals — drop individual entries with
	// an unrecognized errorType rather than failing the whole batch.
	return {
		errors: parsed.errors.filter((err: { errorType: string }) => isValidErrorType(err.errorType)) as GrammarAnalysisError[],
	};
}

/**
 * Analyze a simulation transcript for context and phrasing errors in the
 * student's turns using Gemini. Retries once on malformed JSON or failed
 * shape validation before giving up.
 */
export async function analyzeGrammarAndContext(
	transcript: GrammarAnalysisTranscriptTurn[],
	retriesRemaining = 1
): Promise<GrammarAnalysisResult> {
	try {
		return await callGeminiForGrammarAnalysis(transcript);
	} catch (error: any) {
		if (retriesRemaining > 0) {
			logger.warn('Grammar analysis failed, retrying once', { error: error.message });
			return analyzeGrammarAndContext(transcript, retriesRemaining - 1);
		}
		logger.error('Error analyzing simulation transcript for grammar and context', { error: error.message });
		throw new Error(`Failed to analyze simulation transcript: ${error.message}`);
	}
}
