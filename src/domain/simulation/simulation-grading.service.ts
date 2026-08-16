// Shared grading logic for a completed Simulation Room session: runs SpeechAce
// scoring for every student turn (in parallel), grammar/context analysis, and
// competency scoring, then persists the aggregate result onto the session.
//
// Used by POST /api/v1/simulation/sessions/[sessionId]/grade — student-triggered,
// on-demand grading only. Grading no longer fires automatically on session
// completion (see turn/route.ts and end/route.ts).
import { connectToDatabase } from '@/lib/api/db';
import { logger } from '@/lib/api/logger';
import SimulationSession, { ISimulationSession } from '@/models/simulation-session';
import SimulationScenario from '@/models/simulation-scenario';
import { speechaceService } from '@/lib/api/speechace.service';
import {
	analyzeGrammarAndContext,
	GrammarAnalysisResult,
} from '@/domain/simulation/simulation-grammar-analysis.service';
import {
	scoreCompetencies,
	CompetencyScoringResult,
} from '@/domain/simulation/simulation-competency-scoring.service';

export interface MispronouncedWord {
	word: string;
	score: number;
	turnNumber: number;
}

export interface SimulationGradeResult {
	pronunciation: {
		gradedTurnCount: number;
		failedTurnCount: number;
		mispronouncedWords: MispronouncedWord[];
	};
	grammar: GrammarAnalysisResult;
	competency: CompetencyScoringResult;
	gradedAt: Date;
}

// SpeechAce quality_score runs 0-100; below this a word is surfaced to the
// student as "mispronounced" in the review screen.
const MISPRONOUNCED_SCORE_THRESHOLD = 70;

export async function gradeSimulationSession(sessionId: string): Promise<SimulationGradeResult> {
	await connectToDatabase();

	const session = await SimulationSession.findById(sessionId);

	if (!session) {
		throw new Error('Session not found');
	}

	if (session.status !== 'completed') {
		throw new Error('Session must be completed before grading');
	}

	const scenario = await SimulationScenario.findById(session.scenarioId);

	if (!scenario) {
		throw new Error('Scenario not found');
	}

	const transcript = session.turns.map((turn: ISimulationSession['turns'][number]) => ({
		turnNumber: turn.turnNumber,
		role: turn.role,
		text: turn.text,
	}));

	const gradableTurns = session.turns.filter(
		(turn: ISimulationSession['turns'][number]) => turn.role === 'student' && !!turn.audioUrl,
	);

	const studentId = session.studentId.toString();

	const [pronunciationResults, grammarResult, competencyResult] = await Promise.all([
		Promise.all(
			gradableTurns.map(async (turn: ISimulationSession['turns'][number]) => {
				try {
					const audioResponse = await fetch(turn.audioUrl);
					if (!audioResponse.ok) {
						throw new Error(`Failed to download turn audio: ${audioResponse.status} ${audioResponse.statusText}`);
					}
					const audioArrayBuffer = await audioResponse.arrayBuffer();
					const audioBuffer = Buffer.from(audioArrayBuffer);

					const speechaceResult = await speechaceService.scorePronunciation(
						turn.text,
						audioBuffer,
						studentId,
					);

					return { turnNumber: turn.turnNumber, speechaceResult };
				} catch (error: any) {
					logger.warn('[SimulationGrading] Failed to score turn', {
						error: error.message,
						sessionId,
						turnNumber: turn.turnNumber,
					});
					return { turnNumber: turn.turnNumber, speechaceResult: null };
				}
			}),
		),
		(async (): Promise<GrammarAnalysisResult> => {
			try {
				return await analyzeGrammarAndContext(transcript);
			} catch (error: any) {
				logger.warn('[SimulationGrading] Grammar analysis failed', {
					error: error.message,
					sessionId,
				});
				return { errors: [] };
			}
		})(),
		(async (): Promise<CompetencyScoringResult> => {
			try {
				return await scoreCompetencies(scenario.gradingRubric, transcript, scenario.weeklyFocus);
			} catch (error: any) {
				logger.warn('[SimulationGrading] Competency scoring failed', {
					error: error.message,
					sessionId,
				});
				return { competencyScores: [], overallSummary: '' };
			}
		})(),
	]);

	const resultsByTurnNumber = new Map(pronunciationResults.map((r) => [r.turnNumber, r.speechaceResult]));
	for (const turn of session.turns) {
		if (resultsByTurnNumber.has(turn.turnNumber)) {
			turn.speechaceResult = resultsByTurnNumber.get(turn.turnNumber);
		}
	}

	const failedTurnCount = pronunciationResults.filter((r) => r.speechaceResult === null).length;
	const gradedTurnCount = pronunciationResults.length - failedTurnCount;

	// Word-level pronunciation detail only exists on each turn's speechaceResult
	// (word_scores) — it isn't aggregated anywhere else, so we flatten it here
	// into a single list the client can render directly.
	const mispronouncedWords: MispronouncedWord[] = [];
	for (const result of pronunciationResults) {
		const wordScores = result.speechaceResult?.word_scores ?? [];
		for (const wordScore of wordScores) {
			if (typeof wordScore.score === 'number' && wordScore.score < MISPRONOUNCED_SCORE_THRESHOLD) {
				mispronouncedWords.push({
					word: wordScore.word,
					score: wordScore.score,
					turnNumber: result.turnNumber,
				});
			}
		}
	}

	const gradeResult: SimulationGradeResult = {
		pronunciation: { gradedTurnCount, failedTurnCount, mispronouncedWords },
		grammar: grammarResult,
		competency: competencyResult,
		gradedAt: new Date(),
	};

	session.overallGradeResult = gradeResult;
	await session.save();

	return gradeResult;
}
