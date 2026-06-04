import { Types } from 'mongoose';
import DrillAttempt from '@/models/drill-attempt';
import PronunciationAttemptModel from '@/models/pronunciation-attempt';
import FreeTalkAttempt from '@/models/free-talk-attempt';
import type { IDrillAttempt } from '@/models/drill-attempt';
import type { IPronunciationAttempt } from '@/models/pronunciation-attempt';
import type { IFreeTalkAttempt } from '@/models/free-talk-attempt';
import type { WeaknessSignal, WeaknessProfile } from './types';

function clamp(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function severityFromScore(score: number): number {
	return clamp(1 - score / 100);
}

function extractPronunciationSignals(
	pronAttempts: IPronunciationAttempt[]
): WeaknessSignal[] {
	if (pronAttempts.length === 0) return [];

	const avgTextScore =
		pronAttempts.reduce((sum, a) => sum + a.textScore, 0) / pronAttempts.length;
	const avgFluency =
		pronAttempts.reduce((sum, a) => sum + (a.fluencyScore ?? a.textScore), 0) /
		pronAttempts.length;

	// Collect unique incorrect phonemes across all attempts
	const phonemeFreq = new Map<string, number>();
	for (const attempt of pronAttempts) {
		for (const p of attempt.incorrectPhonemes ?? []) {
			phonemeFreq.set(p, (phonemeFreq.get(p) ?? 0) + 1);
		}
	}
	const topPhonemes = [...phonemeFreq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([p]) => p);

	const signals: WeaknessSignal[] = [];

	if (avgTextScore < 85) {
		signals.push({
			drillType: 'pronunciation',
			category: 'pronunciation',
			severity: severityFromScore(avgTextScore),
			evidence: [
				`Average pronunciation score: ${avgTextScore.toFixed(1)}`,
				...(topPhonemes.length > 0
					? [`Weak phonemes: ${topPhonemes.join(', ')}`]
					: []),
			],
			label:
				topPhonemes.length > 0
					? `Pronunciation — phonemes: ${topPhonemes.join(', ')}`
					: 'Pronunciation accuracy',
		});
	}

	if (avgFluency < 80) {
		signals.push({
			drillType: 'pronunciation',
			category: 'fluency',
			severity: severityFromScore(avgFluency),
			evidence: [`Average fluency score: ${avgFluency.toFixed(1)}`],
			label: 'Fluency',
		});
	}

	return signals;
}

function extractVocabularySignals(
	attempts: IDrillAttempt[],
	drillType: 'vocabulary' | 'key_phrases'
): WeaknessSignal[] {
	const weakWords: string[] = [];
	let totalScore = 0;
	let count = 0;

	for (const attempt of attempts) {
		const wordScores =
			drillType === 'vocabulary'
				? attempt.vocabularyResults?.wordScores
				: attempt.keyPhrasesResults?.items?.map((item) => ({
						word: item.prompt,
						score: item.pronunciationScore ?? (item.isCorrect ? 100 : 0),
						attempts: item.attempts,
						pronunciationScore: item.pronunciationScore,
					}));

		if (!wordScores) continue;

		for (const ws of wordScores) {
			const score = ws.pronunciationScore ?? ws.score;
			totalScore += score;
			count++;
			if (score < 70 || (ws.attempts > 2)) {
				weakWords.push(ws.word ?? (ws as { prompt?: string }).prompt ?? '');
			}
		}
	}

	if (count === 0) return [];
	const avg = totalScore / count;
	if (avg >= 85 && weakWords.length === 0) return [];

	const uniqueWeak = [...new Set(weakWords)].slice(0, 5);
	return [
		{
			drillType,
			category: 'vocabulary',
			severity: severityFromScore(avg),
			evidence: [
				`Average score: ${avg.toFixed(1)}`,
				...(uniqueWeak.length > 0
					? [`Struggled with: ${uniqueWeak.join(', ')}`]
					: []),
			],
			label:
				drillType === 'key_phrases' ? 'Key phrases accuracy' : 'Vocabulary pronunciation',
		},
	];
}

function extractRoleplaySignals(attempts: IDrillAttempt[]): WeaknessSignal[] {
	let fluencyTotal = 0;
	let pronTotal = 0;
	let count = 0;

	for (const attempt of attempts) {
		for (const scene of attempt.roleplayResults?.sceneScores ?? []) {
			fluencyTotal += scene.fluencyScore ?? scene.score;
			pronTotal += scene.pronunciationScore ?? scene.score;
			count++;
		}
	}

	if (count === 0) return [];

	const avgFluency = fluencyTotal / count;
	const avgPron = pronTotal / count;
	const signals: WeaknessSignal[] = [];

	if (avgFluency < 75) {
		signals.push({
			drillType: 'roleplay',
			category: 'fluency',
			severity: severityFromScore(avgFluency),
			evidence: [`Average roleplay fluency: ${avgFluency.toFixed(1)}`],
			label: 'Roleplay fluency',
		});
	}

	if (avgPron < 75) {
		signals.push({
			drillType: 'roleplay',
			category: 'pronunciation',
			severity: severityFromScore(avgPron),
			evidence: [`Average roleplay pronunciation: ${avgPron.toFixed(1)}`],
			label: 'Roleplay pronunciation',
		});
	}

	return signals;
}

function extractAccuracySignals(
	attempts: IDrillAttempt[],
	drillType: 'fill_blank' | 'matching' | 'definition'
): WeaknessSignal[] {
	const accuracies: number[] = [];

	for (const attempt of attempts) {
		let accuracy: number | undefined;

		if (drillType === 'fill_blank') {
			const r = attempt.fillBlankResults;
			if (r?.totalBlanks && r.totalBlanks > 0) {
				accuracy = r.score ?? ((r.correctBlanks ?? 0) / r.totalBlanks) * 100;
			}
		} else if (drillType === 'matching') {
			const r = attempt.matchingResults;
			if (r?.accuracy != null) accuracy = r.accuracy;
		} else {
			const r = attempt.definitionResults;
			if (r?.accuracy != null) accuracy = r.accuracy;
		}

		if (accuracy != null) accuracies.push(accuracy);
	}

	if (accuracies.length === 0) return [];

	const avg = accuracies.reduce((s, v) => s + v, 0) / accuracies.length;
	if (avg >= 80) return [];

	const categoryMap: Record<string, WeaknessSignal['category']> = {
		fill_blank: 'grammar',
		matching: 'vocabulary',
		definition: 'vocabulary',
	};

	return [
		{
			drillType,
			category: categoryMap[drillType],
			severity: severityFromScore(avg),
			evidence: [`Average accuracy: ${avg.toFixed(1)}%`],
			label: `${drillType.replace('_', ' ')} accuracy`,
		},
	];
}

function extractGrammarSignals(attempts: IDrillAttempt[]): WeaknessSignal[] {
	let scoreTotal = 0;
	let count = 0;
	const weakPatterns: string[] = [];

	for (const attempt of attempts) {
		const r = attempt.grammarResults;
		if (!r) continue;

		if (r.accuracy != null) {
			scoreTotal += r.accuracy * 100;
			count++;
		}

		for (const ps of r.patternScores ?? []) {
			if (ps.score < 70 || ps.attempts > 2) {
				weakPatterns.push(ps.pattern);
			}
		}
	}

	if (count === 0 && weakPatterns.length === 0) return [];

	const avg = count > 0 ? scoreTotal / count : 50;
	if (avg >= 80 && weakPatterns.length === 0) return [];

	const uniqueWeak = [...new Set(weakPatterns)].slice(0, 5);
	return [
		{
			drillType: 'grammar',
			category: 'grammar',
			severity: severityFromScore(avg),
			evidence: [
				`Average grammar accuracy: ${avg.toFixed(1)}%`,
				...(uniqueWeak.length > 0
					? [`Weak patterns: ${uniqueWeak.join(', ')}`]
					: []),
			],
			label: 'Grammar accuracy',
		},
	];
}

export async function aggregateWeaknesses(
	learnerId: Types.ObjectId,
	weekStartDate: Date
): Promise<WeaknessProfile> {
	const weekEndDate = new Date(weekStartDate);
	weekEndDate.setDate(weekEndDate.getDate() + 7);

	const dateFilter = { $gte: weekStartDate, $lt: weekEndDate };

	const [drillAttempts, pronAttempts, freeTalkAttempts] = await Promise.all([
		DrillAttempt.find({
			learnerId,
			completedAt: dateFilter,
		}).lean() as Promise<IDrillAttempt[]>,
		PronunciationAttemptModel.find({
			learnerId,
			createdAt: dateFilter,
		}).lean() as Promise<IPronunciationAttempt[]>,
		FreeTalkAttempt.find({
			learnerId,
			createdAt: dateFilter,
		}).lean() as Promise<IFreeTalkAttempt[]>,
	]);

	// Group drill attempts by type
	const byType = new Map<string, IDrillAttempt[]>();
	for (const attempt of drillAttempts) {
		// IDrill.type is not directly on IDrillAttempt; resolve via drillId lookup is
		// deferred — using performanceReviewSnapshot or the attempt's own result keys
		// to infer type instead.
		// TODO: if drillId population is needed, populate drill.type here
		const type = inferDrillType(attempt);
		if (!type) continue;
		const bucket = byType.get(type) ?? [];
		bucket.push(attempt);
		byType.set(type, bucket);
	}

	const signals: WeaknessSignal[] = [
		...extractPronunciationSignals(pronAttempts),
		...extractVocabularySignals(byType.get('vocabulary') ?? [], 'vocabulary'),
		...extractVocabularySignals(byType.get('key_phrases') ?? [], 'key_phrases'),
		...extractRoleplaySignals(byType.get('roleplay') ?? []),
		...extractAccuracySignals(byType.get('fill_blank') ?? [], 'fill_blank'),
		...extractAccuracySignals(byType.get('matching') ?? [], 'matching'),
		...extractAccuracySignals(byType.get('definition') ?? [], 'definition'),
		...extractGrammarSignals(byType.get('grammar') ?? []),
		...extractFreeTalkSignals(freeTalkAttempts),
		// sentence, summary, listening: skipped — no reliable automated weakness signal
	];

	signals.sort((a, b) => b.severity - a.severity);
	const meaningfulSignals = signals.filter((s) => s.severity > 0);

	return {
		learnerId,
		weekStartDate,
		weaknesses: signals,
		topWeaknesses: meaningfulSignals.slice(0, 3),
		generatedAt: new Date(),
	};
}

function extractFreeTalkSignals(attempts: IFreeTalkAttempt[]): WeaknessSignal[] {
	const graded = attempts.filter((a) => a.gradeResult !== null);
	if (graded.length === 0) return [];

	const weakBehaviourNames: string[] = [];
	let severitySum = 0;

	for (const attempt of graded) {
		const { overallScore, maxScore, behaviours } = attempt.gradeResult!;
		if (maxScore > 0) {
			severitySum += clamp(1 - overallScore / maxScore);
		}
		for (const b of behaviours) {
			if (b.result === 'none' || b.result === 'partial') {
				weakBehaviourNames.push(b.name);
			}
		}
	}

	if (weakBehaviourNames.length === 0) return [];

	const severity = clamp(severitySum / graded.length);

	const scenarioTypeFreq = new Map<string, number>();
	for (const attempt of graded) {
		const t = attempt.scenarioType;
		scenarioTypeFreq.set(t, (scenarioTypeFreq.get(t) ?? 0) + 1);
	}
	const topScenarioType = [...scenarioTypeFreq.entries()].sort((a, b) => b[1] - a[1])[0][0];

	const uniqueWeakNames = [...new Set(weakBehaviourNames)].slice(0, 5);

	return [
		{
			drillType: 'free_talk',
			category: 'fluency',
			severity,
			evidence: uniqueWeakNames,
			label: `Clinical communication — ${topScenarioType}`,
		},
	];
}

function inferDrillType(attempt: IDrillAttempt): string | null {
	return attempt.drillType ?? null;
}
