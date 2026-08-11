import { logger } from '@/lib/api/logger';
import { genAI, DEFAULT_MODEL } from '@/services/gemini.service';

export interface ScenarioExtractionResult {
	displayData: string;
	hiddenContext: string;
}

function buildExtractionPrompt(rawSlideText: string): string {
	return `You are classifying content extracted from a tutor's training slide deck for a workplace roleplay simulation.

Split the slide text below into two parts:
1. Student-facing situational data — the information a student would see when starting the simulation (e.g. patient history, vitals, lab results, customer details, scenario background).
2. Tutor-only framing/instructions — context, grading notes, or instructor guidance that must be stripped out before the student ever sees it.

Raw slide text:
${rawSlideText}

Return ONLY valid JSON with this exact shape:
{
  "displayData": <string, the student-facing situational data, formatted as readable text>,
  "hiddenContext": <string, the tutor-only framing/instructions; empty string if none found>
}`;
}

async function callGeminiForExtraction(rawSlideText: string): Promise<ScenarioExtractionResult> {
	if (!genAI) {
		throw new Error('Gemini API is not configured');
	}

	const model = genAI.getGenerativeModel({
		model: DEFAULT_MODEL,
		generationConfig: {
			temperature: 0.2,
			// Slide decks can run much longer than a listening-comprehension transcript
			// (multiple slides of patient/case background), so this is raised well above
			// the 3000 baseline used for analyzeListeningComprehension.
			maxOutputTokens: 8000,
		},
	});

	const prompt = buildExtractionPrompt(rawSlideText);
	const result = await model.generateContent(prompt);
	const responseText = result.response.text();

	const jsonMatch = responseText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Failed to parse scenario extraction response');
	}

	const parsed = JSON.parse(jsonMatch[0]) as ScenarioExtractionResult;
	if (typeof parsed.displayData !== 'string' || typeof parsed.hiddenContext !== 'string') {
		throw new Error('Invalid scenario extraction response shape');
	}

	return parsed;
}

/**
 * Classify raw parsed slide text into student-facing displayData and
 * tutor-only hiddenContext using Gemini. Retries once on malformed JSON or
 * failed shape validation before giving up.
 */
export async function extractScenarioContext(
	rawSlideText: string,
	retriesRemaining = 1
): Promise<ScenarioExtractionResult> {
	try {
		return await callGeminiForExtraction(rawSlideText);
	} catch (error: any) {
		if (retriesRemaining > 0) {
			logger.warn('Scenario extraction failed, retrying once', { error: error.message });
			return extractScenarioContext(rawSlideText, retriesRemaining - 1);
		}
		logger.error('Error extracting simulation scenario context', { error: error.message });
		throw new Error(`Failed to extract simulation scenario context: ${error.message}`);
	}
}
